import * as Y from "yjs"
import { layoutBoundLine, updateBoundLines } from "./geometry.js"
import type { Shape } from "./types.js"

/**
 * One local board document, with connector layout and local undo history.
 * Owns its Y.Doc; callers may attach a transport to doc and must detach it
 * before destroying the store. Construction performs no browser or network IO.
 */
export class BoardStore {
  readonly boardId: string
  readonly doc = new Y.Doc()
  readonly yShapes: Y.Map<Shape>
  readonly yMeta: Y.Map<string>
  readonly undoManager: Y.UndoManager
  /** Origin token marking local transactions (tracked by undo). */
  readonly origin = Symbol("local")

  private shapesSnapshot: Array<Shape> = []
  private shapesById: Map<string, Shape> = new Map()
  private destroyed = false
  private listeners = new Set<() => void>()

  constructor(boardId: string) {
    this.boardId = boardId
    this.yShapes = this.doc.getMap<Shape>("shapes")
    this.yMeta = this.doc.getMap<string>("meta")

    this.undoManager = new Y.UndoManager(this.yShapes, {
      trackedOrigins: new Set([this.origin]),
    })

    this.yShapes.observe(() => {
      this.rebuildShapes()
      this.emit()
    })
    this.yMeta.observe(() => this.emit())
    this.undoManager.on("stack-item-added", () => this.emit())
    this.undoManager.on("stack-item-popped", () => this.emit())
    this.undoManager.on("stack-cleared", () => this.emit())
  }

  destroy() {
    if (this.destroyed) return
    this.destroyed = true
    this.listeners.clear()
    this.undoManager.destroy()
    this.doc.destroy()
  }

  // --- subscriptions -------------------------------------------------------

  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  protected emit() {
    for (const l of this.listeners) l()
  }

  private rebuildShapes() {
    const shapes = [...this.yShapes.values()]
    shapes.sort((a, b) => a.order - b.order || (a.id < b.id ? -1 : 1))
    const byId = new Map(shapes.map((s) => [s.id, s]))
    // Remote edits can merge a node's new position with an older connector.
    // Derive the visible endpoints from the merged document without creating
    // another shared write or an undo entry for a remote change.
    this.shapesSnapshot = shapes.map((shape) =>
      shape.type === "line" || shape.type === "arrow"
        ? layoutBoundLine(shape, (id) => byId.get(id))
        : shape
    )
    this.shapesById = new Map(this.shapesSnapshot.map((s) => [s.id, s]))
  }

  getShapes = () => this.shapesSnapshot
  getShape(id: string): Shape | undefined {
    return this.shapesById.get(id)
  }
  getBoardName = () => this.yMeta.get("name") ?? ""
  getCanUndo = () => this.undoManager.canUndo()
  getCanRedo = () => this.undoManager.canRedo()

  // --- mutations -----------------------------------------------------------

  transact(fn: () => void) {
    this.doc.transact(fn, this.origin)
  }

  putShape(shape: Shape) {
    this.putShapes([shape])
  }

  putShapes(shapes: Array<Shape>) {
    const all = new Map(this.yShapes)
    for (const shape of shapes) all.set(shape.id, shape)
    const updated = updateBoundLines(shapes, [...all.values()])
    this.transact(() => {
      // Keep node changes and attached connectors in the same undo step.
      for (const shape of updated) this.yShapes.set(shape.id, shape)
    })
  }

  deleteShapes(ids: Iterable<string>) {
    const deleted = new Set(ids)
    this.transact(() => {
      // A remote node edit can leave stored endpoints behind the displayed
      // ones. Freeze the current geometry before a target disappears, while
      // retaining its binding ID so undo can restore the attachment.
      for (const shape of this.shapesSnapshot) {
        if (deleted.has(shape.id)) continue
        if (shape.type !== "line" && shape.type !== "arrow") continue
        if (
          (shape.startBinding && deleted.has(shape.startBinding)) ||
          (shape.endBinding && deleted.has(shape.endBinding))
        ) {
          this.yShapes.set(shape.id, shape)
        }
      }
      for (const id of deleted) this.yShapes.delete(id)
    })
  }

  nextOrder(): number {
    let max = 0
    for (const shape of this.shapesSnapshot) max = Math.max(max, shape.order)
    return max + 1
  }

  setBoardName(name: string) {
    this.doc.transact(() => this.yMeta.set("name", name))
  }

  undo() {
    this.undoManager.undo()
  }

  redo() {
    this.undoManager.redo()
  }

  /** Start a new undo group before an independent editing action. */
  stopCapturing() {
    this.undoManager.stopCapturing()
  }
}
