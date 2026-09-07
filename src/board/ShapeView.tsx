import { memo } from "react"
import { getStroke } from "perfect-freehand"
import {
  FONT_STYLES,
  PALETTE,
  PEN_SIZES,
  STROKE_WIDTHS,
  shapeFont,
  shapeFontSize,
} from "@kritzlboard/core"
import type { DrawShape, FontId, LineShape, Shape } from "@kritzlboard/core"

export function getSvgPathFromStroke(points: Array<Array<number>>): string {
  if (points.length === 0) return ""
  const d = points.reduce(
    (acc, [x0, y0], i, arr) => {
      const [x1, y1] = arr[(i + 1) % arr.length]
      acc.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2)
      return acc
    },
    ["M", ...points[0], "Q"] as Array<number | string>
  )
  d.push("Z")
  return d.map((v) => (typeof v === "number" ? v.toFixed(2) : v)).join(" ")
}

export function getDrawPath(shape: DrawShape): string {
  const pts: Array<Array<number>> = []
  for (let i = 0; i < shape.points.length; i += 2) {
    pts.push([shape.points[i], shape.points[i + 1]])
  }
  const outline = getStroke(pts, {
    size: PEN_SIZES[shape.size],
    thinning: 0.55,
    smoothing: 0.5,
    streamline: 0.45,
    simulatePressure: true,
  })
  return getSvgPathFromStroke(outline)
}

function arrowheadPath(shape: LineShape): string {
  const len = Math.hypot(shape.dx, shape.dy)
  if (len < 1) return ""
  const strokeWidth = STROKE_WIDTHS[shape.size]
  const size = Math.min(Math.max(strokeWidth * 4, 12), len * 0.5)
  const angle = Math.atan2(shape.dy, shape.dx)
  const tipX = shape.x + shape.dx
  const tipY = shape.y + shape.dy
  const spread = Math.PI / 6
  const ax = tipX - Math.cos(angle - spread) * size
  const ay = tipY - Math.sin(angle - spread) * size
  const bx = tipX - Math.cos(angle + spread) * size
  const by = tipY - Math.sin(angle + spread) * size
  return `M ${ax} ${ay} L ${tipX} ${tipY} L ${bx} ${by}`
}

/** Centered label for box-like shapes (rect, ellipse). */
function BoxLabel({
  x,
  y,
  w,
  h,
  text,
  fontSize,
  font,
  color,
}: {
  x: number
  y: number
  w: number
  h: number
  text: string
  fontSize: number
  font: FontId
  color: string
}) {
  return (
    <foreignObject x={x} y={y} width={w} height={h} pointerEvents="none">
      <div
        className="shape-label"
        style={{ fontSize, color, ...FONT_STYLES[font] }}
      >
        {text}
      </div>
    </foreignObject>
  )
}

/** Label centered on a line/arrow's midpoint. */
function LineLabel({
  shape,
  fontSize,
  color,
}: {
  shape: LineShape
  fontSize: number
  color: string
}) {
  const lines = (shape.text ?? "").split("\n")
  const midX = shape.x + shape.dx / 2
  const midY = shape.y + shape.dy / 2
  const lineHeight = fontSize * 1.35
  return (
    <text
      x={midX}
      y={midY - ((lines.length - 1) / 2) * lineHeight}
      textAnchor="middle"
      dominantBaseline="central"
      fill={color}
      fontSize={fontSize}
      stroke="var(--background)"
      strokeWidth={fontSize / 4}
      paintOrder="stroke"
      strokeLinejoin="round"
      pointerEvents="none"
      style={{ ...FONT_STYLES[shapeFont(shape)], whiteSpace: "pre" }}
    >
      {lines.map((line, i) => (
        <tspan key={i} x={midX} dy={i === 0 ? 0 : lineHeight}>
          {/* empty tspans would collapse and swallow the dy offset */}
          {line === "" ? "\u00a0" : line}
        </tspan>
      ))}
    </text>
  )
}

export const ShapeView = memo(function ShapeView({
  shape,
  fadeOut,
  hideLabel,
}: {
  shape: Shape
  fadeOut?: boolean
  hideLabel?: boolean
}) {
  const palette = PALETTE[shape.color]
  const strokeWidth = STROKE_WIDTHS[shape.size]
  const labelFontSize = shapeFontSize(shape)
  const font = shapeFont(shape)
  const opacity = fadeOut ? 0.4 : 1
  const strokeStyle =
    ("strokeStyle" in shape ? shape.strokeStyle : undefined) ?? "solid"
  const strokeDasharray =
    strokeStyle === "dashed"
      ? `${6 * strokeWidth} ${4 * strokeWidth}`
      : strokeStyle === "dotted"
        ? `${2 * strokeWidth} ${3 * strokeWidth}`
        : undefined

  switch (shape.type) {
    case "rect": {
      const rx = Math.min(6, shape.w / 4, shape.h / 4)
      return (
        <g data-shape-id={shape.id} opacity={opacity}>
          <rect
            x={shape.x}
            y={shape.y}
            width={shape.w}
            height={shape.h}
            rx={rx}
            fill={shape.fill === "none" ? "transparent" : palette.fill}
            fillOpacity={shape.fill === "semi" ? 0.55 : 1}
            stroke={palette.stroke}
            strokeWidth={strokeWidth}
            strokeDasharray={strokeDasharray}
          />
          {!hideLabel && shape.text && (
            <BoxLabel
              x={shape.x}
              y={shape.y}
              w={shape.w}
              h={shape.h}
              text={shape.text}
              fontSize={labelFontSize}
              font={font}
              color={palette.stroke}
            />
          )}
        </g>
      )
    }
    case "ellipse":
      return (
        <g data-shape-id={shape.id} opacity={opacity}>
          <ellipse
            cx={shape.x + shape.w / 2}
            cy={shape.y + shape.h / 2}
            rx={shape.w / 2}
            ry={shape.h / 2}
            fill={shape.fill === "none" ? "transparent" : palette.fill}
            fillOpacity={shape.fill === "semi" ? 0.55 : 1}
            stroke={palette.stroke}
            strokeWidth={strokeWidth}
            strokeDasharray={strokeDasharray}
          />
          {!hideLabel && shape.text && (
            <BoxLabel
              x={shape.x}
              y={shape.y}
              w={shape.w}
              h={shape.h}
              text={shape.text}
              fontSize={labelFontSize}
              font={font}
              color={palette.stroke}
            />
          )}
        </g>
      )
    case "line":
    case "arrow": {
      const x2 = shape.x + shape.dx
      const y2 = shape.y + shape.dy
      return (
        <g data-shape-id={shape.id} opacity={opacity}>
          {/* invisible wide stroke to make thin lines easy to hit */}
          <line
            x1={shape.x}
            y1={shape.y}
            x2={x2}
            y2={y2}
            stroke="transparent"
            strokeWidth={Math.max(strokeWidth, 12)}
          />
          <line
            x1={shape.x}
            y1={shape.y}
            x2={x2}
            y2={y2}
            stroke={palette.stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={strokeDasharray}
            pointerEvents="none"
          />
          {shape.type === "arrow" && (
            <path
              d={arrowheadPath(shape)}
              fill="none"
              stroke={palette.stroke}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={strokeDasharray}
              pointerEvents="none"
            />
          )}
          {!hideLabel && shape.text && (
            <LineLabel
              shape={shape}
              fontSize={labelFontSize}
              color={palette.stroke}
            />
          )}
        </g>
      )
    }
    case "draw":
      return (
        <g
          data-shape-id={shape.id}
          opacity={opacity}
          transform={`translate(${shape.x} ${shape.y})`}
        >
          <path
            d={getDrawPath(shape)}
            fill={palette.stroke}
            stroke="transparent"
            strokeWidth={8}
          />
        </g>
      )
    case "text":
      return (
        <g data-shape-id={shape.id} opacity={opacity}>
          {/* transparent backdrop so the whole text block is hittable */}
          <rect
            x={shape.x}
            y={shape.y}
            width={Math.max(shape.w, 8)}
            height={Math.max(shape.h, labelFontSize)}
            fill="transparent"
          />
          <foreignObject
            x={shape.x}
            y={shape.y}
            width={Math.max(shape.w, 8) + 2}
            height={Math.max(shape.h, labelFontSize * 1.35) + 2}
            pointerEvents="none"
          >
            <div
              className="shape-text-content"
              style={{
                fontSize: labelFontSize,
                color: PALETTE[shape.color].stroke,
                ...FONT_STYLES[font],
              }}
            >
              {shape.text}
            </div>
          </foreignObject>
        </g>
      )
  }
})
