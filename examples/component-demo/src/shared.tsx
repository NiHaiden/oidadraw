import { useEffect } from "react"
import { useBoardName, useBoardStore, useCanUndoRedo, useShapes } from "@kritzlboard/react"
import type { BoardStore, ColorId, Shape } from "@kritzlboard/core"

export function starterShapes(color: ColorId = "blue"): Array<Shape> {
  return [
    { id: "idea", type: "rect", order: 1, color, size: "m", fill: "semi", x: -220, y: -64, w: 170, h: 128, text: "Your idea", font: "hand" },
    { id: "next", type: "ellipse", order: 2, color, size: "m", fill: "none", x: 74, y: -64, w: 148, h: 128, text: "What's next?", font: "hand", textSize: "s" },
    { id: "connection", type: "arrow", order: 3, color, size: "m", x: -50, y: 0, dx: 124, dy: 0, startBinding: "idea", endBinding: "next" },
  ]
}

export function resetDocument(store: BoardStore, color: ColorId = "blue") {
  store.stopCapturing()
  store.deleteShapes(store.getShapes().map((shape) => shape.id))
  store.putShapes(starterShapes(color))
  store.stopCapturing()
}

/** Seeding belongs to the demo; useBoardStore owns the document lifecycle. */
export function useDemoStore(id: string, color: ColorId = "blue") {
  const store = useBoardStore(id)
  useEffect(() => {
    if (!store) return
    store.putShapes(starterShapes(color))
    store.setBoardName("Untitled sketch")
    store.undoManager.clear()
  }, [store, color])
  return store
}

export function DocumentFooter({ store, color = "blue" }: { store: BoardStore; color?: ColorId }) {
  const shapes = useShapes(store)
  const name = useBoardName(store)
  const { canUndo, canRedo } = useCanUndoRedo(store)
  return (
    <div className="document-footer">
      <label className="document-name">
        <span className="sr-only">Board name</span>
        <input value={name} onChange={(event) => store.setBoardName(event.target.value)} aria-label="Board name" />
      </label>
      <span className="shape-count">{shapes.length} shapes</span>
      <div className="document-actions">
        <button type="button" disabled={!canUndo} onClick={() => store.undo()}>Undo</button>
        <button type="button" disabled={!canRedo} onClick={() => store.redo()}>Redo</button>
        <button type="button" onClick={() => resetDocument(store, color)}>Reset shapes</button>
      </div>
    </div>
  )
}

export function LoadingBoard() {
  return <div className="board-loading" role="status">Preparing your canvas…</div>
}
