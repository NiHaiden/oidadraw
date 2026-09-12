import {
  Circle,
  Eraser,
  Hand,
  Minus,
  MousePointer2,
  MoveUpRight,
  Pencil,
  Redo2,
  Square,
  Type,
  Undo2,
} from "lucide-react"
import { useCanUndoRedo } from "./hooks.js"
import { cn } from "./classes.js"
import type { LucideIcon } from "lucide-react"
import type { BoardStore, ToolId } from "@kritzlboard/core"

const TOOLS: Array<{
  id: ToolId
  icon: LucideIcon
  label: string
  kbd: string
}> = [
  { id: "select", icon: MousePointer2, label: "Select", kbd: "V" },
  { id: "hand", icon: Hand, label: "Hand", kbd: "H" },
  { id: "draw", icon: Pencil, label: "Draw", kbd: "P" },
  { id: "eraser", icon: Eraser, label: "Eraser", kbd: "E" },
  { id: "rect", icon: Square, label: "Rectangle", kbd: "R" },
  { id: "ellipse", icon: Circle, label: "Ellipse", kbd: "O" },
  { id: "line", icon: Minus, label: "Line", kbd: "L" },
  { id: "arrow", icon: MoveUpRight, label: "Arrow", kbd: "A" },
  { id: "text", icon: Type, label: "Text", kbd: "T" },
]

export function Toolbar({
  store,
  tool,
  onToolChange,
}: {
  store: BoardStore
  tool: ToolId
  onToolChange: (tool: ToolId) => void
}) {
  const { canUndo, canRedo } = useCanUndoRedo(store)

  return (
    <div className="kb-toolbar kb-panel">
      <button
        type="button"
        className="kb-icon-button kb-tool-button"
        title="Undo (Ctrl+Z)"
        disabled={!canUndo}
        onClick={() => store.undo()}
      >
        <Undo2 className="kb-tool-icon" />
      </button>
      <button
        type="button"
        className="kb-icon-button kb-tool-button"
        title="Redo (Ctrl+Shift+Z)"
        disabled={!canRedo}
        onClick={() => store.redo()}
      >
        <Redo2 className="kb-tool-icon" />
      </button>
      <div className="kb-divider" />
      {TOOLS.map(({ id, icon: Icon, label, kbd }) => (
        <button
          type="button"
          key={id}
          className={cn(
            "kb-icon-button kb-tool-button",
            tool === id ? "kb-tool-active" : "kb-tool-idle"
          )}
          title={`${label} (${kbd})`}
          onClick={() => onToolChange(id)}
        >
          <Icon className="kb-tool-icon" />
        </button>
      ))}
    </div>
  )
}
