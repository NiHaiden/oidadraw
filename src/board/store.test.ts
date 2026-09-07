import { afterEach, describe, expect, it, vi } from "vitest"
import { BoardStore as CoreBoardStore } from "@kritzlboard/core"
import * as Y from "yjs"
import {
  Awareness,
  applyAwarenessUpdate,
  encodeAwarenessUpdate,
} from "y-protocols/awareness"
import { BoardStore } from "./store"

vi.mock("@/lib/user", () => ({
  getUser: () => ({ name: "Test", color: "blue" }),
}))

vi.mock("y-websocket", async () => {
  const { Awareness: ProviderAwareness } = await import("y-protocols/awareness")
  const { Observable } = await import("lib0/observable")
  return {
    WebsocketProvider: class extends Observable<string> {
      awareness: Awareness
      constructor(_url: string, _room: string, doc: Y.Doc) {
        super()
        this.awareness = new ProviderAwareness(doc)
      }
      destroy = vi.fn(() => {
        this.awareness.destroy()
        super.destroy()
      })
    },
  }
})

const stores: Array<BoardStore> = []

function createStore() {
  vi.stubGlobal("location", { protocol: "http:", host: "localhost" })
  const store = new BoardStore("test-board")
  stores.push(store)
  return store
}

afterEach(() => {
  for (const store of stores.splice(0)) store.destroy()
  vi.unstubAllGlobals()
})

describe("application BoardStore adapter", () => {
  it("adds local identity and presence to the core document", () => {
    const store = createStore()
    expect(store).toBeInstanceOf(CoreBoardStore)
    expect(store.provider.awareness.getLocalState()?.user).toEqual({
      name: "Test",
      color: "blue",
    })
    store.setCursor({ x: 10, y: 20 })
    store.setSelectionPresence(["selected"])
    store.setUser({ name: "Renamed", color: "red" })

    expect(store.provider.awareness.getLocalState()).toEqual({
      user: { name: "Renamed", color: "red" },
      cursor: { x: 10, y: 20 },
      selection: ["selected"],
    })
  })

  it("notifies subscribers about connection status and remote peers", () => {
    const store = createStore()
    const changed = vi.fn()
    store.subscribe(changed)
    expect(store.getStatus()).toBe("connecting")
    store.provider.emit("status", [{ status: "connected" }])
    expect(store.getStatus()).toBe("connected")
    expect(changed).toHaveBeenCalled()

    const remoteDoc = new Y.Doc()
    const remote = new Awareness(remoteDoc)
    try {
      changed.mockClear()
      remote.setLocalState({
        user: { name: "Peer", color: "green" },
        cursor: { x: 30, y: 40 },
        selection: ["remote-selection"],
      })
      applyAwarenessUpdate(
        store.provider.awareness,
        encodeAwarenessUpdate(remote, [remote.clientID]),
        "remote"
      )
      expect(store.getPeers()).toEqual([
        { clientId: remote.clientID, ...remote.getLocalState() },
      ])
      expect(changed).toHaveBeenCalled()
      expect(store.getShapes()).toEqual([])

      changed.mockClear()
      store.provider.emit("connection-close", [null, store.provider])
      expect(store.getStatus()).toBe("offline")
      expect(changed).toHaveBeenCalled()
    } finally {
      remote.destroy()
      remoteDoc.destroy()
    }
  })

  it("destroys the transport before its document and only once", () => {
    const store = createStore()
    const onDestroy = vi.fn(() => {
      expect(store.provider.destroy).toHaveBeenCalledTimes(1)
    })
    store.doc.on("destroy", onDestroy)
    store.destroy()
    store.destroy()
    expect(onDestroy).toHaveBeenCalledTimes(1)
    expect(store.provider.destroy).toHaveBeenCalledTimes(1)
  })
})
