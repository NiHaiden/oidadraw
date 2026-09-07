import {
  COLOR_IDS,
  FONT_STYLES,
  PALETTE,
  isTextEditable,
} from "@kritzlboard/core"
import { cn } from "@/lib/utils"
import type {
  FillStyle,
  FontId,
  Shape,
  SizeId,
  StyleDefaults,
  StrokeStyle,
  TextSizeId,
  ToolId,
} from "@kritzlboard/core"

const SHAPE_TOOLS: Array<ToolId> = [
  "draw",
  "rect",
  "ellipse",
  "line",
  "arrow",
  "text",
]

const FILLS: Array<{ id: FillStyle; label: string }> = [
  { id: "none", label: "None" },
  { id: "semi", label: "Semi" },
  { id: "solid", label: "Solid" },
]

const STROKE_STYLES: Array<{ id: StrokeStyle; label: string }> = [
  { id: "solid", label: "Solid" },
  { id: "dashed", label: "Dashed" },
  { id: "dotted", label: "Dotted" },
]

const FONTS: Array<{ id: FontId; label: string }> = [
  { id: "sans", label: "Normal" },
  { id: "hand", label: "Handwritten" },
]

const SIZES: Array<{ id: SizeId; label: string; dot: number }> = [
  { id: "s", label: "Small", dot: 6 },
  { id: "m", label: "Medium", dot: 9 },
  { id: "l", label: "Large", dot: 13 },
]

/** px is just how big the "A" on the button is drawn. */
const TEXT_SIZES: Array<{ id: TextSizeId; label: string; px: number }> = [
  { id: "s", label: "Small", px: 10 },
  { id: "m", label: "Medium", px: 13 },
  { id: "l", label: "Large", px: 17 },
  { id: "xl", label: "Huge", px: 22 },
]

export function StylePanel({
  tool,
  selectedShapes,
  style,
  onChange,
}: {
  tool: ToolId
  selectedShapes: Array<Shape>
  style: StyleDefaults
  onChange: (patch: Partial<StyleDefaults>) => void
}) {
  const visible = SHAPE_TOOLS.includes(tool) || selectedShapes.length > 0
  if (!visible) return null

  const showFill =
    tool === "rect" ||
    tool === "ellipse" ||
    selectedShapes.some((s) => s.type === "rect" || s.type === "ellipse")

  const showStrokeStyle =
    (SHAPE_TOOLS.includes(tool) &&
      (tool === "line" ||
        tool === "arrow" ||
        tool === "rect" ||
        tool === "ellipse")) ||
    selectedShapes.some(
      (s) =>
        s.type === "line" ||
        s.type === "arrow" ||
        s.type === "rect" ||
        s.type === "ellipse"
    )

  // every shape but a freehand stroke can carry text
  const showFont =
    (SHAPE_TOOLS.includes(tool) && tool !== "draw") ||
    selectedShapes.some(isTextEditable)

  // size is the outline width, which a standalone text box does not have
  const showSize =
    (SHAPE_TOOLS.includes(tool) && tool !== "text") ||
    selectedShapes.some((s) => s.type !== "text")

  return (
    <div className="absolute top-16 right-3 flex w-40 flex-col gap-3 rounded-xl border border-border bg-white p-3 shadow-lg">
      <div>
        <div className="mb-1.5 text-[11px] font-medium text-neutral-500">
          Color
        </div>
        <div className="grid grid-cols-5 gap-1.5">
          {COLOR_IDS.map((id) => (
            <button
              key={id}
              title={id}
              className={cn(
                "size-6 rounded-md border-2",
                style.color === id
                  ? "border-blue-600"
                  : "border-transparent hover:border-neutral-300"
              )}
              style={{ backgroundColor: PALETTE[id].stroke }}
              onClick={() => onChange({ color: id })}
            />
          ))}
        </div>
      </div>

      {showFill && (
        <div>
          <div className="mb-1.5 text-[11px] font-medium text-neutral-500">
            Fill
          </div>
          <div className="flex gap-1">
            {FILLS.map(({ id, label }) => (
              <button
                key={id}
                className={cn(
                  "flex-1 rounded-md border px-1 py-1 text-[11px]",
                  style.fill === id
                    ? "border-blue-600 bg-blue-50 text-blue-700"
                    : "border-border text-neutral-600 hover:bg-neutral-50"
                )}
                onClick={() => onChange({ fill: id })}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {showStrokeStyle && (
        <div>
          <div className="mb-1.5 text-[11px] font-medium text-neutral-500">
            Stroke
          </div>
          <div className="flex gap-1">
            {STROKE_STYLES.map(({ id, label }) => (
              <button
                key={id}
                className={cn(
                  "flex-1 rounded-md border px-1 py-1 text-[11px]",
                  style.strokeStyle === id
                    ? "border-blue-600 bg-blue-50 text-blue-700"
                    : "border-border text-neutral-600 hover:bg-neutral-50"
                )}
                onClick={() => onChange({ strokeStyle: id })}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {showSize && (
        <div>
          <div className="mb-1.5 text-[11px] font-medium text-neutral-500">
            Size
          </div>
          <div className="flex gap-1">
            {SIZES.map(({ id, label, dot }) => (
              <button
                key={id}
                title={label}
                className={cn(
                  "flex h-8 flex-1 items-center justify-center rounded-md border",
                  style.size === id
                    ? "border-blue-600 bg-blue-50"
                    : "border-border hover:bg-neutral-50"
                )}
                onClick={() => onChange({ size: id })}
              >
                <span
                  className="rounded-full bg-neutral-700"
                  style={{ width: dot, height: dot }}
                />
              </button>
            ))}
          </div>
        </div>
      )}

      {showFont && (
        <div>
          <div className="mb-1.5 text-[11px] font-medium text-neutral-500">
            Text size
          </div>
          <div className="flex gap-1">
            {TEXT_SIZES.map(({ id, label, px }) => (
              <button
                key={id}
                title={label}
                aria-label={label}
                className={cn(
                  "flex h-8 flex-1 items-center justify-center rounded-md border leading-none",
                  style.textSize === id
                    ? "border-blue-600 bg-blue-50 text-blue-700"
                    : "border-border text-neutral-600 hover:bg-neutral-50"
                )}
                onClick={() => onChange({ textSize: id })}
              >
                <span style={{ fontSize: px }}>A</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {showFont && (
        <div>
          <div className="mb-1.5 text-[11px] font-medium text-neutral-500">
            Font
          </div>
          <div className="flex gap-1">
            {FONTS.map(({ id, label }) => (
              <button
                key={id}
                title={label}
                className={cn(
                  "flex h-9 flex-1 items-center justify-center rounded-md border text-lg leading-none",
                  style.font === id
                    ? "border-blue-600 bg-blue-50 text-blue-700"
                    : "border-border text-neutral-600 hover:bg-neutral-50"
                )}
                style={FONT_STYLES[id]}
                onClick={() => onChange({ font: id })}
              >
                Aa
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
