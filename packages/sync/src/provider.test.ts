import { afterEach, describe, expect, it, vi } from "vitest"
import { BoardStore } from "@kritzlboard/core"
import { BoardConnection } from "./index.js"
import type { RectShape } from "@kritzlboard/core"

const connections: Array<BoardConnection> = []
const stores: Array<BoardStore> = []
function peer(name: string, room: string) {
  const store = new BoardStore(room)
  const connection = new BoardConnection({
    store,
    url: "ws://localhost/sync",
    user: { name, color: "blue" },
    providerOptions: { connect: false },
  })
  stores.push(store)
  connections.push(connection)
  // Exercise the real y-websocket protocol through its cross-tab transport.
  // No server is needed and WebSocket communication remains disabled.
  connection.provider.connectBc()
  return { store, connection }
}
function rect(id: string): RectShape {
  return {
    id,
    type: "rect",
    order: 1,
    color: "black",
    size: "m",
    fill: "none",
    x: 0,
    y: 0,
    w: 100,
    h: 80,
  }
}
afterEach(() => {
  for (const connection of connections.splice(0)) connection.destroy()
  for (const store of stores.splice(0)) store.destroy()
  vi.useRealTimers()
})

describe("real provider integration", () => {
  it("synchronizes edits, metadata, and presence while keeping local undo separate", () => {
    const room = `integration-${crypto.randomUUID()}`
    const left = peer("Left", room)
    left.store.putShape(rect("left"))
    const right = peer("Right", room)
    expect(right.store.getShapes()).toEqual(left.store.getShapes())
    expect(right.store.getCanUndo()).toBe(false)
    expect(left.connection.getPeers().map((p) => p.user.name)).toEqual([
      "Right",
    ])
    expect(right.connection.getPeers().map((p) => p.user.name)).toEqual([
      "Left",
    ])
    right.connection.setCursor({ x: 40, y: 50 })
    right.connection.setSelectionPresence(["left"])
    expect(left.connection.getPeers()[0]).toMatchObject({
      cursor: { x: 40, y: 50 },
      selection: ["left"],
    })
    right.store.putShape(rect("right"))
    left.store.setBoardName("Shared name")
    expect(right.store.getBoardName()).toBe("Shared name")
    left.store.undo()
    expect(left.store.getShapes().map((s) => s.id)).toEqual(["right"])
    expect(right.store.getShapes()).toEqual(left.store.getShapes())
    right.connection.disconnect()
    expect(left.connection.getPeers()).toEqual([])
    expect(right.connection.getPeers()).toEqual([])
    right.connection.provider.connectBc()
    expect(left.connection.getPeers()[0].user.name).toBe("Right")
    right.connection.destroy()
    expect(left.connection.getPeers()).toEqual([])
    expect(right.store.doc.isDestroyed).toBe(false)
    left.store.putShape(rect("after-disconnect"))
    expect(right.store.getShape("after-disconnect")).toBeUndefined()
  })

  it("isolates rooms and can replace a connection without replacing its document", () => {
    vi.useFakeTimers()
    const room = `integration-${crypto.randomUUID()}`
    const first = peer("First", room)
    const other = peer("Other", `${room}-other`)
    first.store.putShape(rect("local"))
    expect(other.store.getShapes()).toEqual([])
    first.connection.destroy()
    const replacement = new BoardConnection({
      store: first.store,
      url: "ws://localhost/sync",
      user: { name: "Reconnected", color: "red" },
      providerOptions: { connect: false },
    })
    connections.push(replacement)
    replacement.provider.connectBc()
    const joined = peer("Joined", room)
    expect(joined.store.getShapes()).toEqual([rect("local")])
    expect(joined.connection.getPeers()[0].user.name).toBe("Reconnected")
    for (const connection of connections) connection.destroy()
    expect(vi.getTimerCount()).toBe(0)
    expect(first.store.getShapes()).toEqual([rect("local")])
  })
})
