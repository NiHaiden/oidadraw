import { FONT_STYLES } from "./typography.js"
import { COLOR_IDS, PALETTE, isTextEditable } from "@kritzlboard/core"
import { cn } from "./classes.js"
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
    <div className="kb-style-panel kb-panel">
      <div>
        <div className="kb-field-label">Color</div>
        <div className="kb-color-grid">
          {COLOR_IDS.map((id) => (
            <button
              type="button"
              key={id}
              title={id}
              className={cn(
                "kb-color-button",
                style.color === id ? "kb-color-active" : "kb-color-idle"
              )}
              style={{ backgroundColor: PALETTE[id].stroke }}
              onClick={() => onChange({ color: id })}
            />
          ))}
        </div>
      </div>

      {showFill && (
        <div>
          <div className="kb-field-label">Fill</div>
          <div className="kb-options">
            {FILLS.map(({ id, label }) => (
              <button
                type="button"
                key={id}
                className={cn(
                  "kb-option kb-option-text",
                  style.fill === id ? "kb-option-active" : "kb-option-idle"
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
          <div className="kb-field-label">Stroke</div>
          <div className="kb-options">
            {STROKE_STYLES.map(({ id, label }) => (
              <button
                type="button"
                key={id}
                className={cn(
                  "kb-option kb-option-text",
                  style.strokeStyle === id
                    ? "kb-option-active"
                    : "kb-option-idle"
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
          <div className="kb-field-label">Size</div>
          <div className="kb-options">
            {SIZES.map(({ id, label, dot }) => (
              <button
                type="button"
                key={id}
                title={label}
                className={cn(
                  "kb-option kb-option-size",
                  style.size === id ? "kb-option-active" : "kb-option-idle"
                )}
                onClick={() => onChange({ size: id })}
              >
                <span
                  className="kb-size-dot"
                  style={{ width: dot, height: dot }}
                />
              </button>
            ))}
          </div>
        </div>
      )}

      {showFont && (
        <div>
          <div className="kb-field-label">Text size</div>
          <div className="kb-options">
            {TEXT_SIZES.map(({ id, label, px }) => (
              <button
                type="button"
                key={id}
                title={label}
                aria-label={label}
                className={cn(
                  "kb-option kb-option-size",
                  style.textSize === id ? "kb-option-active" : "kb-option-idle"
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
          <div className="kb-field-label">Font</div>
          <div className="kb-options">
            {FONTS.map(({ id, label }) => (
              <button
                type="button"
                key={id}
                title={label}
                className={cn(
                  "kb-option kb-option-font",
                  style.font === id ? "kb-option-active" : "kb-option-idle"
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
