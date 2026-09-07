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
import { useCanUndoRedo } from "./store"
import { cn } from "@/lib/utils"
import type { LucideIcon } from "lucide-react"
import type { BoardStore } from "./store"
import type { ToolId } from "@kritzlboard/core"

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
    <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-xl border border-border bg-white p-1 shadow-lg">
      <button
        className="flex size-9 items-center justify-center rounded-lg text-neutral-600 hover:bg-neutral-100 disabled:opacity-30 disabled:hover:bg-transparent"
        title="Undo (Ctrl+Z)"
        disabled={!canUndo}
        onClick={() => store.undo()}
      >
        <Undo2 className="size-4.5" />
      </button>
      <button
        className="flex size-9 items-center justify-center rounded-lg text-neutral-600 hover:bg-neutral-100 disabled:opacity-30 disabled:hover:bg-transparent"
        title="Redo (Ctrl+Shift+Z)"
        disabled={!canRedo}
        onClick={() => store.redo()}
      >
        <Redo2 className="size-4.5" />
      </button>
      <div className="mx-1 h-6 w-px bg-border" />
      {TOOLS.map(({ id, icon: Icon, label, kbd }) => (
        <button
          key={id}
          className={cn(
            "flex size-9 items-center justify-center rounded-lg",
            tool === id
              ? "bg-blue-600 text-white"
              : "text-neutral-700 hover:bg-neutral-100"
          )}
          title={`${label} (${kbd})`}
          onClick={() => onToolChange(id)}
        >
          <Icon className="size-4.5" />
        </button>
      ))}
    </div>
  )
}
