import { COLOR_IDS, PALETTE } from "./types"
import { cn } from "@/lib/utils"
import type { FillStyle, Shape, SizeId, StyleDefaults, ToolId } from "./types"

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

const SIZES: Array<{ id: SizeId; label: string; dot: number }> = [
  { id: "s", label: "Small", dot: 6 },
  { id: "m", label: "Medium", dot: 9 },
  { id: "l", label: "Large", dot: 13 },
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
    </div>
  )
}
