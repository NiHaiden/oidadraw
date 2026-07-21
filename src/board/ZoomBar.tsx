import { Maximize, Minus, Plus } from "lucide-react"

export function ZoomBar({
  zoom,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  onZoomToFit,
}: {
  zoom: number
  onZoomIn: () => void
  onZoomOut: () => void
  onZoomReset: () => void
  onZoomToFit: () => void
}) {
  return (
    <div className="absolute bottom-4 left-3 flex items-center gap-0.5 rounded-xl border border-border bg-white p-1 shadow-lg">
      <button
        className="flex size-8 items-center justify-center rounded-lg text-neutral-600 hover:bg-neutral-100"
        title="Zoom out (Ctrl+-)"
        onClick={onZoomOut}
      >
        <Minus className="size-4" />
      </button>
      <button
        className="w-12 rounded-lg py-1.5 text-center text-xs text-neutral-700 tabular-nums hover:bg-neutral-100"
        title="Reset zoom (Ctrl+0)"
        onClick={onZoomReset}
      >
        {Math.round(zoom * 100)}%
      </button>
      <button
        className="flex size-8 items-center justify-center rounded-lg text-neutral-600 hover:bg-neutral-100"
        title="Zoom in (Ctrl++)"
        onClick={onZoomIn}
      >
        <Plus className="size-4" />
      </button>
      <button
        className="flex size-8 items-center justify-center rounded-lg text-neutral-600 hover:bg-neutral-100"
        title="Zoom to fit"
        onClick={onZoomToFit}
      >
        <Maximize className="size-4" />
      </button>
    </div>
  )
}
