import { afterEach, describe, expect, it, vi } from "vitest"
import { BoardStore } from "@kritzlboard/core"
import * as Y from "yjs"
import {
  Awareness,
  applyAwarenessUpdate,
  encodeAwarenessUpdate,
} from "y-protocols/awareness"
import { BoardConnection } from "./index.js"
import type { BoardConnectionOptions } from "./index.js"

const calls = vi.hoisted(() => ({ construct: vi.fn(), connect: vi.fn() }))
vi.mock("y-websocket", async () => {
  const { Awareness: ProviderAwareness } = await import("y-protocols/awareness")
  const { Observable } = await import("lib0/observable")
  return {
    WebsocketProvider: class extends Observable<string> {
      awareness: Awareness
      constructor(url: string, room: string, doc: Y.Doc, options: unknown) {
        super()
        calls.construct(url, room, doc, options)
        this.awareness = new ProviderAwareness(doc)
      }
      connect = vi.fn(() => calls.connect(this.awareness.getLocalState()))
      disconnect = vi.fn(() =>
        this.emit("status", [{ status: "disconnected" }])
      )
      destroy = vi.fn(() => super.destroy())
    },
  }
})

const stores: Array<BoardStore> = []
const connections: Array<BoardConnection> = []
function createConnection(
  providerOptions?: BoardConnectionOptions["providerOptions"]
) {
  const store = new BoardStore("project-sketch")
  stores.push(store)
  const connection = new BoardConnection({
    store,
    url: "wss://boards.example/sync",
    user: { name: "Test", color: "blue" },
    providerOptions,
  })
  connections.push(connection)
  return { store, connection }
}

afterEach(() => {
  for (const connection of connections.splice(0)) connection.destroy()
  for (const store of stores.splice(0)) store.destroy()
  vi.clearAllMocks()
  vi.useRealTimers()
})

describe("BoardConnection", () => {
  it("uses caller configuration and installs identity before connecting", () => {
    const { store, connection } = createConnection({
      params: { tenant: "project" },
    })
    expect(calls.construct).toHaveBeenCalledWith(
      "wss://boards.example/sync",
      "project-sketch",
      store.doc,
      { connect: false, maxBackoffTime: 5000, params: { tenant: "project" } }
    )
    expect(calls.connect).toHaveBeenCalledWith({
      user: { name: "Test", color: "blue" },
      cursor: null,
      selection: [],
    })
    expect(connection.getStatus()).toBe("connecting")
    // These functions can be passed directly to React's presence interface.
    const { setCursor, setSelectionPresence, setUser } = connection
    const snapshot = connection.getPeers()
    setCursor({ x: 10, y: 20 })
    setSelectionPresence(["selected"])
    setUser({ name: "Renamed", color: "red" })
    expect(connection.getPeers()).toBe(snapshot)
    expect(connection.provider.awareness.getLocalState()).toEqual({
      user: { name: "Renamed", color: "red" },
      cursor: { x: 10, y: 20 },
      selection: ["selected"],
    })
  })

  it("reports disconnects as offline until a reconnect attempt starts", () => {
    const { connection } = createConnection({ connect: false })
    expect(calls.connect).not.toHaveBeenCalled()
    expect(connection.getStatus()).toBe("offline")
    const states: Array<string> = []
    const unsubscribe = connection.subscribe(() =>
      states.push(connection.getStatus())
    )
    connection.connect()
    connection.provider.emit("status", [{ status: "connected" }])
    connection.provider.emit("connection-close", [null, connection.provider])
    connection.provider.emit("status", [{ status: "disconnected" }])
    expect(connection.getStatus()).toBe("offline")
    connection.provider.emit("status", [{ status: "connecting" }])
    connection.disconnect()
    expect(states).toEqual([
      "connecting",
      "connected",
      "offline",
      "connecting",
      "offline",
    ])
    unsubscribe()
    connection.connect()
    expect(states).toHaveLength(5)
  })

  it("provides cached, sorted remote presence snapshots and removes departed peers", () => {
    const { connection, store } = createConnection()
    const remoteDocs = [new Y.Doc(), new Y.Doc()]
    const remotes = remoteDocs.map((doc) => new Awareness(doc))
    const changed = vi.fn()
    connection.subscribe(changed)
    const publish = (remote: Awareness) =>
      applyAwarenessUpdate(
        connection.provider.awareness,
        encodeAwarenessUpdate(remote, [remote.clientID]),
        "remote"
      )
    try {
      const empty = connection.getPeers()
      expect(connection.getPeers()).toBe(empty)
      for (const remote of remotes) {
        remote.setLocalState({ user: { name: "Peer", color: "green" } })
        publish(remote)
      }
      const peers = connection.getPeers()
      expect(peers).toEqual(
        remotes
          .map((remote) => ({
            clientId: remote.clientID,
            user: { name: "Peer", color: "green" },
            cursor: null,
            selection: [],
          }))
          .sort((a, b) => a.clientId - b.clientId)
      )
      expect(connection.getPeers()).toBe(peers)
      expect(changed).toHaveBeenCalled()
      expect(store.getShapes()).toEqual([])
      remotes[0].setLocalState(null)
      publish(remotes[0])
      expect(connection.getPeers().map((peer) => peer.clientId)).toEqual([
        remotes[1].clientID,
      ])
    } finally {
      remotes.forEach((remote) => remote.destroy())
      remoteDocs.forEach((doc) => doc.destroy())
    }
  })

  it("closes transport and presence once while keeping the document usable", () => {
    vi.useFakeTimers()
    const { store, connection } = createConnection()
    const awarenessDestroyed = vi.fn()
    connection.provider.awareness.on("destroy", awarenessDestroyed)
    expect(vi.getTimerCount()).toBeGreaterThan(0)
    connection.destroy()
    connection.destroy()
    expect(connection.provider.destroy).toHaveBeenCalledTimes(1)
    expect(awarenessDestroyed).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)
    expect(store.doc.isDestroyed).toBe(false)
    store.setBoardName("Still local")
    expect(store.getBoardName()).toBe("Still local")
    connection.connect()
    connection.setUser({ name: "Too late", color: "red" })
    expect(connection.provider.connect).toHaveBeenCalledTimes(1)
    expect(connection.provider.awareness.getLocalState()).toBeNull()
    expect(connection.getStatus()).toBe("offline")
  })

  it("also detaches when the host destroys its store first", () => {
    const { store, connection } = createConnection()
    store.destroy()
    expect(connection.provider.destroy).toHaveBeenCalledTimes(1)
    expect(connection.getStatus()).toBe("offline")
    expect(
      () =>
        new BoardConnection({
          store,
          url: "wss://example.test",
          user: { name: "Test", color: "blue" },
        })
    ).toThrow("destroyed board store")
  })
})
