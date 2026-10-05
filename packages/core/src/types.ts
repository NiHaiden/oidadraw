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
export type StrokeStyle = "solid" | "dashed" | "dotted"
export type SizeId = "s" | "m" | "l"
/** Text size, finer-grained than the shape's own `size`. */
export type TextSizeId = "s" | "m" | "l" | "xl"
export type FontId = "sans" | "hand"

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
/** Font size per text size; s/m/l match what shapes had before this existed. */
export const TEXT_FONT_SIZES: Record<TextSizeId, number> = {
  s: 18,
  m: 28,
  l: 44,
  xl: 72,
}

/** CSS for each font, spread into the style of anything rendering shape text. */
export const FONT_STYLES: Record<
  FontId,
  { fontFamily: string; fontWeight: number }
> = {
  sans: { fontFamily: "var(--font-sans)", fontWeight: 400 },
  // Caveat's regular weight reads too thin next to Inter
  hand: { fontFamily: "var(--font-hand)", fontWeight: 600 },
}

export const DEFAULT_FONT: FontId = "sans"
export const DEFAULT_TEXT_SIZE: TextSizeId = "m"

/** Font of a shape, defaulting for shapes saved before fonts existed. */
export function shapeFont(shape: Shape): FontId {
  return ("font" in shape ? shape.font : undefined) ?? DEFAULT_FONT
}

/** Font size a shape's text renders at. */
export function shapeFontSize(shape: Shape): number {
  // an explicit choice wins; labels drawn before it existed follow the size
  const chosen = "textSize" in shape ? shape.textSize : undefined
  if (chosen) return TEXT_FONT_SIZES[chosen]
  // standalone text boxes store their own font size, labels derive theirs
  return shape.type === "text" ? shape.fontSize : FONT_SIZES[shape.size]
}

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
  strokeStyle?: StrokeStyle
  /** label text, centered inside the shape (absent on older boards) */
  text?: string
  /** label typeface (absent on older boards) */
  font?: FontId
  /** label size, independent of the shape's `size` (absent = follow it) */
  textSize?: TextSizeId
}

export interface EllipseShape extends BaseShape {
  type: "ellipse"
  x: number
  y: number
  w: number
  h: number
  fill: FillStyle
  strokeStyle?: StrokeStyle
  /** label text, centered inside the shape (absent on older boards) */
  text?: string
  /** label typeface (absent on older boards) */
  font?: FontId
  /** label size, independent of the shape's `size` (absent = follow it) */
  textSize?: TextSizeId
}

export type BindingPointId = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w"

/** A fixed attachment on the target's outline, in normalized box coordinates. */
export interface BindingAnchor {
  x: number
  y: number
  /** Named points preserve their position on curved corners when resized. */
  snap?: BindingPointId
}

/** Line/arrow from (x, y) to (x + dx, y + dy). dx/dy may be negative. */
export interface LineShape extends BaseShape {
  type: "line" | "arrow"
  x: number
  y: number
  dx: number
  dy: number
  strokeStyle?: StrokeStyle
  /** id of a shape this end is latched onto; the endpoint is re-derived
   * from the target's edge whenever either shape changes (absent = free) */
  startBinding?: string
  endBinding?: string
  /** Absent on older bindings, which retain their automatic edge positioning. */
  startAnchor?: BindingAnchor
  endAnchor?: BindingAnchor
  /** label text, centered on the line's midpoint (absent on older boards) */
  text?: string
  /** label typeface (absent on older boards) */
  font?: FontId
  /** label size, independent of the shape's `size` (absent = follow it) */
  textSize?: TextSizeId
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
  /** typeface (absent on older boards) */
  font?: FontId
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
  strokeStyle: StrokeStyle
  size: SizeId
  font: FontId
  textSize: TextSizeId
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
