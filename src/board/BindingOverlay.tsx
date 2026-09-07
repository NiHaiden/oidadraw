import {
  getBindingPoints,
  getShapeBounds,
  resolveBindingAnchor,
} from "./geometry"
import type { BindingAnchor, BindingPointId, Shape } from "./types"

/** Connection guides follow the outline, separate from selection resize handles. */
export function BindingOverlay({
  shape,
  anchor,
  snapPointId,
  zoom,
}: {
  shape: Shape
  anchor: BindingAnchor
  snapPointId?: BindingPointId
  zoom: number
}) {
  const bounds = getShapeBounds(shape)
  const point = resolveBindingAnchor(shape, anchor)
  const outline = {
    fill: "none",
    stroke: "#3667e8",
    strokeWidth: 1.5 / zoom,
    strokeDasharray: `${4 / zoom} ${4 / zoom}`,
  }

  return (
    <g data-binding-target={shape.id} pointerEvents="none">
      {shape.type === "ellipse" ? (
        <ellipse
          {...outline}
          cx={bounds.x + bounds.w / 2}
          cy={bounds.y + bounds.h / 2}
          rx={bounds.w / 2}
          ry={bounds.h / 2}
        />
      ) : (
        <rect
          {...outline}
          x={bounds.x}
          y={bounds.y}
          width={bounds.w}
          height={bounds.h}
          rx={Math.min(6, bounds.w / 4, bounds.h / 4)}
        />
      )}
      {getBindingPoints(shape).map(({ id, point: marker }) => (
        <circle
          key={id}
          data-binding-point={id}
          cx={marker.x}
          cy={marker.y}
          r={(id === snapPointId ? 6 : 4) / zoom}
          fill={id === snapPointId ? "#3667e8" : "white"}
          stroke="#3667e8"
          strokeWidth={1.5 / zoom}
        />
      ))}
      <circle
        data-binding-anchor={snapPointId ? "snapped" : "edge"}
        cx={point.x}
        cy={point.y}
        r={9 / zoom}
        fill="none"
        stroke="#3667e8"
        strokeWidth={1.5 / zoom}
        opacity={0.6}
      />
    </g>
  )
}
