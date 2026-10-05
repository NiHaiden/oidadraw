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
    <div className="kb-zoom kb-panel">
      <button
        type="button"
        className="kb-icon-button kb-zoom-button"
        title="Zoom out (Ctrl+-)"
        onClick={onZoomOut}
      >
        <Minus className="kb-zoom-icon" />
      </button>
      <button
        type="button"
        className="kb-zoom-value"
        title="Reset zoom (Ctrl+0)"
        onClick={onZoomReset}
      >
        {Math.round(zoom * 100)}%
      </button>
      <button
        type="button"
        className="kb-icon-button kb-zoom-button"
        title="Zoom in (Ctrl++)"
        onClick={onZoomIn}
      >
        <Plus className="kb-zoom-icon" />
      </button>
      <button
        type="button"
        className="kb-icon-button kb-zoom-button"
        title="Zoom to fit"
        onClick={onZoomToFit}
      >
        <Maximize className="kb-zoom-icon" />
      </button>
    </div>
  )
}
