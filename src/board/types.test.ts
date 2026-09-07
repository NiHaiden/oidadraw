import { describe, expect, it } from "vitest"
import { shapeFontSize } from "./types"
import type { EllipseShape, LineShape, RectShape, TextShape } from "./types"

const base = { id: "1", order: 1, color: "black" as const, size: "m" as const }
const rect: RectShape = {
  ...base,
  type: "rect",
  x: 0,
  y: 0,
  w: 10,
  h: 10,
  fill: "none",
}
const ellipse: EllipseShape = {
  ...base,
  type: "ellipse",
  x: 0,
  y: 0,
  w: 10,
  h: 10,
  fill: "none",
}
const line: LineShape = { ...base, type: "line", x: 0, y: 0, dx: 10, dy: 0 }
const text: TextShape = {
  ...base,
  type: "text",
  x: 0,
  y: 0,
  w: 10,
  h: 10,
  text: "hi",
  fontSize: 42,
}

describe("shapeFontSize", () => {
  it("lets labels follow the shape size until one is picked", () => {
    expect(shapeFontSize(rect)).toBe(28) // FONT_SIZES.m
    expect(shapeFontSize({ ...rect, size: "l" })).toBe(44)
    expect(shapeFontSize({ ...ellipse, textSize: "xl" })).toBe(72)
    // an explicit label size wins over the shape's own size
    expect(shapeFontSize({ ...line, size: "s", textSize: "l" })).toBe(44)
  })

  it("keeps a text box on its own stored font size", () => {
    // the size knob never touches it; only the text-size knob rewrites fontSize
    expect(shapeFontSize({ ...text, size: "s" })).toBe(42)
  })
})
