import type { Camera, Shape } from "./types"

export interface Box {
  x: number
  y: number
  w: number
  h: number
}

export interface Point {
  x: number
  y: number
}

export function screenToWorld(p: Point, camera: Camera): Point {
  return { x: p.x / camera.z + camera.x, y: p.y / camera.z + camera.y }
}

export function worldToScreen(p: Point, camera: Camera): Point {
  return { x: (p.x - camera.x) * camera.z, y: (p.y - camera.y) * camera.z }
}

/** Box from two corner points, normalized to positive w/h. */
export function boxFromPoints(a: Point, b: Point): Box {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    w: Math.abs(a.x - b.x),
    h: Math.abs(a.y - b.y),
  }
}

export function boxesIntersect(a: Box, b: Box): boolean {
  return (
    a.x <= b.x + b.w && b.x <= a.x + a.w && a.y <= b.y + b.h && b.y <= a.y + a.h
  )
}

export function getShapeBounds(shape: Shape): Box {
  switch (shape.type) {
    case "rect":
    case "ellipse":
    case "draw":
    case "text":
      return { x: shape.x, y: shape.y, w: shape.w, h: shape.h }
    case "line":
    case "arrow":
      return boxFromPoints(
        { x: shape.x, y: shape.y },
        { x: shape.x + shape.dx, y: shape.y + shape.dy }
      )
  }
}

export function getCommonBounds(shapes: Array<Shape>): Box | null {
  if (shapes.length === 0) return null
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const shape of shapes) {
    const b = getShapeBounds(shape)
    minX = Math.min(minX, b.x)
    minY = Math.min(minY, b.y)
    maxX = Math.max(maxX, b.x + b.w)
    maxY = Math.max(maxY, b.y + b.h)
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
}

export function translateShape<TShape extends Shape>(
  shape: TShape,
  dx: number,
  dy: number
): TShape {
  return { ...shape, x: shape.x + dx, y: shape.y + dy }
}

/**
 * Map a shape from one reference box to another (used for resizing a
 * selection). Both boxes must have positive dimensions.
 */
export function resizeShape(shape: Shape, from: Box, to: Box): Shape {
  const sx = to.w / Math.max(from.w, 1e-9)
  const sy = to.h / Math.max(from.h, 1e-9)
  const mapX = (x: number) => to.x + (x - from.x) * sx
  const mapY = (y: number) => to.y + (y - from.y) * sy

  switch (shape.type) {
    case "rect":
    case "ellipse":
      return {
        ...shape,
        x: mapX(shape.x),
        y: mapY(shape.y),
        w: Math.max(shape.w * sx, 1),
        h: Math.max(shape.h * sy, 1),
      }
    case "line":
    case "arrow":
      return {
        ...shape,
        x: mapX(shape.x),
        y: mapY(shape.y),
        dx: shape.dx * sx,
        dy: shape.dy * sy,
      }
    case "draw": {
      const points = shape.points.map((v, i) => (i % 2 === 0 ? v * sx : v * sy))
      return {
        ...shape,
        x: mapX(shape.x),
        y: mapY(shape.y),
        w: Math.max(shape.w * sx, 1),
        h: Math.max(shape.h * sy, 1),
        points,
      }
    }
    case "text": {
      const scale = Math.max(Math.min(sx, sy), 8 / shape.fontSize)
      return {
        ...shape,
        x: mapX(shape.x),
        y: mapY(shape.y),
        w: shape.w * scale,
        h: shape.h * scale,
        fontSize: shape.fontSize * scale,
      }
    }
  }
}

export type HandleId = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w"

export const HANDLE_IDS: Array<HandleId> = [
  "nw",
  "n",
  "ne",
  "e",
  "se",
  "s",
  "sw",
  "w",
]

export function getHandlePosition(box: Box, handle: HandleId): Point {
  const cx = box.x + box.w / 2
  const cy = box.y + box.h / 2
  switch (handle) {
    case "nw":
      return { x: box.x, y: box.y }
    case "n":
      return { x: cx, y: box.y }
    case "ne":
      return { x: box.x + box.w, y: box.y }
    case "e":
      return { x: box.x + box.w, y: cy }
    case "se":
      return { x: box.x + box.w, y: box.y + box.h }
    case "s":
      return { x: cx, y: box.y + box.h }
    case "sw":
      return { x: box.x, y: box.y + box.h }
    case "w":
      return { x: box.x, y: cy }
  }
}

export const HANDLE_CURSORS: Record<HandleId, string> = {
  nw: "nwse-resize",
  n: "ns-resize",
  ne: "nesw-resize",
  e: "ew-resize",
  se: "nwse-resize",
  s: "ns-resize",
  sw: "nesw-resize",
  w: "ew-resize",
}

/**
 * Compute the resized box when dragging `handle` of `from` so that the
 * dragged edge/corner lands on `p`. Never inverts; clamps to 1x1.
 */
export function resizeBox(from: Box, handle: HandleId, p: Point): Box {
  let x1 = from.x
  let y1 = from.y
  let x2 = from.x + from.w
  let y2 = from.y + from.h

  if (handle.includes("w")) x1 = Math.min(p.x, x2 - 1)
  if (handle.includes("e")) x2 = Math.max(p.x, x1 + 1)
  if (handle.includes("n")) y1 = Math.min(p.y, y2 - 1)
  if (handle.includes("s")) y2 = Math.max(p.y, y1 + 1)

  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 }
}

/** Snap an offset vector to the nearest multiple of `step` radians. */
export function snapAngle(dx: number, dy: number, step: number): Point {
  const len = Math.hypot(dx, dy)
  if (len === 0) return { x: 0, y: 0 }
  const angle = Math.round(Math.atan2(dy, dx) / step) * step
  return { x: Math.cos(angle) * len, y: Math.sin(angle) * len }
}
