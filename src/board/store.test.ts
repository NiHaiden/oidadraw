import * as Y from "yjs"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { BoardStore } from "./store"
import type { LineShape, RectShape } from "./types"

vi.mock("@/lib/user", () => ({
  getUser: () => ({ name: "Test", color: "blue" }),
}))

vi.mock("y-websocket", () => ({
  WebsocketProvider: class {
    awareness = {
      clientID: 1,
      setLocalState: vi.fn(),
      setLocalStateField: vi.fn(),
      getStates: () => new Map(),
      on: vi.fn(),
    }
    on = vi.fn()
    destroy = vi.fn()
  },
}))

const node: RectShape = {
  id: "node",
  type: "rect",
  order: 1,
  color: "black",
  size: "m",
  fill: "none",
  x: 0,
  y: 0,
  w: 100,
  h: 100,
}
const other: RectShape = { ...node, id: "other", order: 2, x: 300 }
const arrow: LineShape = {
  id: "arrow",
  type: "arrow",
  order: 3,
  color: "black",
  size: "m",
  x: 106,
  y: 50,
  dx: 188,
  dy: 0,
  startBinding: node.id,
  endBinding: other.id,
}
const anchoredArrow: LineShape = {
  ...arrow,
  x: 100,
  y: 25,
  dx: 200,
  dy: 25,
  startAnchor: { x: 1, y: 0.25 },
  endAnchor: { x: 0, y: 0.5, snap: "w" },
}

const stores: Array<BoardStore> = []

function createStore() {
  const store = new BoardStore("test-board")
  stores.push(store)
  return store
}

function getArrow(store: BoardStore): LineShape {
  const shape = store.getShape(arrow.id)
  if (!shape || (shape.type !== "line" && shape.type !== "arrow")) {
    throw new Error("Missing connector")
  }
  return shape
}

beforeEach(() => {
  vi.stubGlobal("location", { protocol: "http:", host: "localhost" })
})

afterEach(() => {
  for (const store of stores.splice(0)) store.destroy()
  vi.unstubAllGlobals()
})

describe("bound connectors in BoardStore", () => {
  it("updates attachments when putShape grows a node for a multiline label", () => {
    const store = createStore()
    const incoming: LineShape = {
      ...arrow,
      x: 50,
      y: -150,
      dx: 0,
      dy: 144,
      startBinding: undefined,
      endBinding: node.id,
    }
    store.putShapes([node, incoming])

    store.putShape({ ...node, y: -50, h: 200, text: "One\nTwo\nThree" })

    expect(getArrow(store)).toMatchObject({ x: 50, y: -150, dx: 0, dy: 94 })
    expect(store.yShapes.get(arrow.id)).toEqual(getArrow(store))
  })

  it("lays out a newly inserted connector using both nodes from its batch", () => {
    const store = createStore()

    store.putShapes([{ ...arrow, x: 0, y: 0, dx: 350, dy: 50 }, node, other])

    expect(getArrow(store)).toEqual(arrow)
    expect(store.yShapes.get(arrow.id)).toEqual(arrow)
  })

  it("updates both ends against the final batch in a single transaction", () => {
    const store = createStore()
    store.putShapes([node, other, arrow])
    const changed = vi.fn()
    store.yShapes.observe(changed)

    store.putShapes([
      { ...node, x: 100, y: 200 },
      { ...other, x: 400, y: 200 },
    ])

    expect(changed).toHaveBeenCalledTimes(1)
    expect(getArrow(store)).toMatchObject({ x: 206, y: 250, dx: 188, dy: 0 })
    expect(store.yShapes.get(arrow.id)).toEqual(getArrow(store))
  })

  it("restores nodes and connector positions together on undo and redo", () => {
    const store = createStore()
    store.putShapes([node, other, arrow])
    store.undoManager.clear()
    store.putShape({ ...node, x: 100 })
    const movedArrow = getArrow(store)
    expect(movedArrow).toMatchObject({ x: 206, dx: 88 })

    store.undo()
    expect(store.getShape(node.id)).toEqual(node)
    expect(getArrow(store)).toEqual(arrow)
    expect(store.yShapes.get(arrow.id)).toEqual(arrow)

    store.redo()
    expect(store.getShape(node.id)).toEqual({ ...node, x: 100 })
    expect(getArrow(store)).toEqual(movedArrow)
    expect(store.yShapes.get(arrow.id)).toEqual(movedArrow)
  })

  it("derives remote node changes without writing them back or adding undo entries", () => {
    const store = createStore()
    const remote = new Y.Doc()
    try {
      const shapes = remote.getMap("shapes")
      remote.transact(() => {
        for (const shape of [node, other, arrow]) shapes.set(shape.id, shape)
      })
      Y.applyUpdate(store.doc, Y.encodeStateAsUpdate(remote))
      const changed = vi.fn()
      store.yShapes.observe(changed)
      shapes.set(node.id, { ...node, x: 100 })

      Y.applyUpdate(store.doc, Y.encodeStateAsUpdate(remote))

      expect(getArrow(store)).toMatchObject({ x: 206, y: 50, dx: 88, dy: 0 })
      expect(store.yShapes.get(arrow.id)).toEqual(arrow)
      expect(store.getCanUndo()).toBe(false)
      expect(changed).toHaveBeenCalledTimes(1)
      expect(store.getShapes()).toBe(store.getShapes())
    } finally {
      remote.destroy()
    }
  })

  it("converges after two peers concurrently move opposite attached nodes", () => {
    const first = createStore()
    const second = createStore()
    first.putShapes([node, other, arrow])
    Y.applyUpdate(second.doc, Y.encodeStateAsUpdate(first.doc))

    first.putShape({ ...node, x: 100 })
    second.putShape({ ...other, y: 200 })
    const firstUpdate = Y.encodeStateAsUpdate(first.doc)
    const secondUpdate = Y.encodeStateAsUpdate(second.doc)
    Y.applyUpdate(first.doc, secondUpdate)
    Y.applyUpdate(second.doc, firstUpdate)

    const attached = getArrow(first)
    const diagonalGap = 6 / Math.sqrt(2)
    expect(attached.x).toBeCloseTo(200 + diagonalGap)
    expect(attached.y).toBeCloseTo(100 + diagonalGap)
    expect(attached.x + attached.dx).toBeCloseTo(300 - diagonalGap)
    expect(attached.y + attached.dy).toBeCloseTo(200 - diagonalGap)
    expect(getArrow(second)).toEqual(attached)
  })

  it("keeps deleted target IDs so undo restores the attachment", () => {
    const store = createStore()
    store.putShapes([node, other, arrow])
    store.undoManager.clear()

    store.deleteShapes([node.id])

    expect(store.getShape(node.id)).toBeUndefined()
    expect(getArrow(store).startBinding).toBe(node.id)
    store.undo()
    expect(store.getShape(node.id)).toEqual(node)
    expect(getArrow(store)).toEqual(arrow)
    store.undoManager.stopCapturing()
    store.putShape({ ...node, x: 100 })
    expect(getArrow(store)).toMatchObject({ x: 206, dx: 88 })
  })

  it("preserves displayed endpoints when deleting a remotely moved target", () => {
    const store = createStore()
    store.putShapes([node, other, arrow])
    store.undoManager.clear()
    // A remote node-only edit updates the snapshot, leaving stored endpoints
    // stale until a local operation writes the connector again.
    const movedNode = { ...node, x: 100 }
    store.doc.transact(() => store.yShapes.set(node.id, movedNode), "remote")
    const displayed = getArrow(store)
    expect(displayed).toMatchObject({ x: 206, dx: 88 })
    expect(store.yShapes.get(arrow.id)).toEqual(arrow)

    store.deleteShapes([node.id])

    expect(store.getShape(node.id)).toBeUndefined()
    expect(getArrow(store)).toEqual(displayed)
    expect(getArrow(store).startBinding).toBe(node.id)
    expect(store.yShapes.get(arrow.id)).toEqual(displayed)
    store.undo()
    expect(store.getShape(node.id)).toEqual(movedNode)
    expect(getArrow(store)).toEqual(displayed)
    store.redo()
    expect(store.getShape(node.id)).toBeUndefined()
    expect(getArrow(store)).toEqual(displayed)
  })

  it("pins an arbitrary source edge anchor when the opposite node moves", () => {
    const store = createStore()
    store.putShapes([node, other, anchoredArrow])

    store.putShape({ ...other, x: 450, y: 200 })

    expect(getArrow(store)).toMatchObject({
      x: 100,
      y: 25,
      dx: 350,
      dy: 225,
      startAnchor: anchoredArrow.startAnchor,
      endAnchor: anchoredArrow.endAnchor,
    })
    expect(store.yShapes.get(arrow.id)).toEqual(getArrow(store))
  })

  it("scales fixed anchors with a resized node and restores them on undo and redo", () => {
    const store = createStore()
    store.putShapes([node, other, anchoredArrow])
    store.undoManager.clear()
    const resizedNode = { ...node, x: 20, y: 40, w: 200, h: 160 }

    store.putShape(resizedNode)

    const resizedArrow = getArrow(store)
    expect(resizedArrow).toMatchObject({
      x: 220,
      y: 80,
      dx: 80,
      dy: -30,
      startAnchor: anchoredArrow.startAnchor,
      endAnchor: anchoredArrow.endAnchor,
    })
    store.undo()
    expect(store.getShape(node.id)).toEqual(node)
    expect(getArrow(store)).toEqual(anchoredArrow)
    store.redo()
    expect(store.getShape(node.id)).toEqual(resizedNode)
    expect(getArrow(store)).toEqual(resizedArrow)
  })

  it("retains exact anchors when remote edits resize and move the attached nodes", () => {
    const store = createStore()
    const remote = new Y.Doc()
    try {
      const shapes = remote.getMap("shapes")
      remote.transact(() => {
        for (const shape of [node, other, anchoredArrow])
          shapes.set(shape.id, shape)
      })
      Y.applyUpdate(store.doc, Y.encodeStateAsUpdate(remote))
      remote.transact(() => {
        shapes.set(node.id, { ...node, x: -100, y: 200, w: 240, h: 200 })
        shapes.set(other.id, { ...other, x: 600, y: 300, h: 200 })
      })

      Y.applyUpdate(store.doc, Y.encodeStateAsUpdate(remote))

      expect(getArrow(store)).toMatchObject({
        x: 140,
        y: 250,
        dx: 460,
        dy: 150,
        startAnchor: anchoredArrow.startAnchor,
        endAnchor: anchoredArrow.endAnchor,
      })
      expect(store.yShapes.get(arrow.id)).toEqual(anchoredArrow)
      expect(store.getCanUndo()).toBe(false)
    } finally {
      remote.destroy()
    }
  })

  it("converges on fixed edge anchors after peers move opposite nodes concurrently", () => {
    const first = createStore()
    const second = createStore()
    first.putShapes([node, other, anchoredArrow])
    Y.applyUpdate(second.doc, Y.encodeStateAsUpdate(first.doc))

    first.putShape({ ...node, x: 100, w: 150 })
    second.putShape({ ...other, y: 200, h: 200 })
    const firstUpdate = Y.encodeStateAsUpdate(first.doc)
    const secondUpdate = Y.encodeStateAsUpdate(second.doc)
    Y.applyUpdate(first.doc, secondUpdate)
    Y.applyUpdate(second.doc, firstUpdate)

    expect(getArrow(first)).toMatchObject({
      x: 250,
      y: 25,
      dx: 50,
      dy: 275,
      startAnchor: anchoredArrow.startAnchor,
      endAnchor: anchoredArrow.endAnchor,
    })
    expect(getArrow(second)).toEqual(getArrow(first))
  })

  it("keeps fixed anchors and displayed endpoints when a target is deleted and restored", () => {
    const store = createStore()
    store.putShapes([node, other, anchoredArrow])
    store.undoManager.clear()
    const movedNode = { ...node, x: 100, y: 200 }
    store.doc.transact(() => store.yShapes.set(node.id, movedNode), "remote")
    const displayed = getArrow(store)
    expect(displayed).toMatchObject({ x: 200, y: 225, dx: 100, dy: -175 })

    store.deleteShapes([node.id])

    expect(getArrow(store)).toEqual(displayed)
    expect(getArrow(store).startAnchor).toEqual(anchoredArrow.startAnchor)
    store.undo()
    expect(store.getShape(node.id)).toEqual(movedNode)
    expect(getArrow(store)).toEqual(displayed)
    store.undoManager.stopCapturing()
    store.putShape({ ...movedNode, h: 200 })
    expect(getArrow(store)).toMatchObject({ x: 200, y: 250, dx: 100, dy: -200 })
  })
})
