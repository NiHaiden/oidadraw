export type ColorId =
  | "black"
  | "grey"
  | "violet"
  | "blue"
  | "cyan"
  | "green"
  | "yellow"
  | "orange"
  | "red"

export type FillStyle = "none" | "semi" | "solid"
export type SizeId = "s" | "m" | "l"

export interface PaletteEntry {
  stroke: string
  fill: string
}

export const PALETTE: Record<ColorId, PaletteEntry> = {
  black: { stroke: "#1d1d1d", fill: "#e8e8e8" },
  grey: { stroke: "#758195", fill: "#e9edf1" },
  violet: { stroke: "#7048c6", fill: "#e5dcf8" },
  blue: { stroke: "#3667e8", fill: "#dae2fa" },
  cyan: { stroke: "#0e98ad", fill: "#d8eef1" },
  green: { stroke: "#099268", fill: "#d5ebe3" },
  yellow: { stroke: "#e0a300", fill: "#f9f0d4" },
  orange: { stroke: "#e16919", fill: "#f8e2d4" },
  red: { stroke: "#e03131", fill: "#f6dcdc" },
}

export const COLOR_IDS = Object.keys(PALETTE) as ColorId[]

/** Outline stroke width per size. */
export const STROKE_WIDTHS: Record<SizeId, number> = { s: 2, m: 3.5, l: 6 }
/** Freehand pen diameter per size. */
export const PEN_SIZES: Record<SizeId, number> = { s: 4, m: 8, l: 14 }
/** Text font size per size. */
export const FONT_SIZES: Record<SizeId, number> = { s: 18, m: 28, l: 44 }

interface BaseShape {
  id: string
  /** paint order; higher paints on top */
  order: number
  color: ColorId
  size: SizeId
}

export interface RectShape extends BaseShape {
  type: "rect"
  x: number
  y: number
  w: number
  h: number
  fill: FillStyle
  /** label text, centered inside the shape (absent on older boards) */
  text?: string
}

export interface EllipseShape extends BaseShape {
  type: "ellipse"
  x: number
  y: number
  w: number
  h: number
  fill: FillStyle
  /** label text, centered inside the shape (absent on older boards) */
  text?: string
}

/** Line/arrow from (x, y) to (x + dx, y + dy). dx/dy may be negative. */
export interface LineShape extends BaseShape {
  type: "line" | "arrow"
  x: number
  y: number
  dx: number
  dy: number
  /** label text, centered on the line's midpoint (absent on older boards) */
  text?: string
}

/** Freehand stroke. Points are [x0, y0, x1, y1, ...] relative to (x, y), spanning [0..w] x [0..h]. */
export interface DrawShape extends BaseShape {
  type: "draw"
  x: number
  y: number
  w: number
  h: number
  points: Array<number>
}

export interface TextShape extends BaseShape {
  type: "text"
  x: number
  y: number
  w: number
  h: number
  text: string
  fontSize: number
}

export type Shape = RectShape | EllipseShape | LineShape | DrawShape | TextShape

/** Shapes that carry editable text (standalone text or a shape label). */
export type TextEditableShape = TextShape | RectShape | EllipseShape | LineShape

export function isTextEditable(shape: Shape): shape is TextEditableShape {
  return shape.type !== "draw"
}

export type ToolId =
  | "select"
  | "hand"
  | "draw"
  | "rect"
  | "ellipse"
  | "line"
  | "arrow"
  | "text"
  | "eraser"

export interface StyleDefaults {
  color: ColorId
  fill: FillStyle
  size: SizeId
}

export interface Camera {
  x: number
  y: number
  z: number
}

export interface UserInfo {
  name: string
  color: string
}

export interface PeerState {
  clientId: number
  user: UserInfo
  cursor: { x: number; y: number } | null
  selection: Array<string>
}
