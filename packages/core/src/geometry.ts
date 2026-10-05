import type {
  BindingAnchor,
  BindingPointId,
  Camera,
  LineShape,
  Shape,
} from "./types.js"

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

export type HandleId = BindingPointId

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

// --- arrow binding ---------------------------------------------------------

/** Gap retained only for boards saved before fixed outline attachments. */
const BIND_GAP = 6

/** Pick nodes within twelve screen pixels of their actual outline. */
export function getBindingMargin(zoom: number): number {
  return 12 / Math.max(zoom, 1e-6)
}

export function isBindable(shape: Shape): boolean {
  return shape.type === "rect" || shape.type === "ellipse"
}

/** Eight useful snap locations, all on the visible outline rather than its box. */
export function getBindingPoints(
  shape: Shape
): Array<{ id: BindingPointId; point: Point }> {
  const b = getShapeBounds(shape)
  const center = shapeCenter(shape)
  const radius = Math.max(0, Math.min(6, b.w / 4, b.h / 4))
  return HANDLE_IDS.map((id) => {
    const dx = id.includes("w") ? -1 : id.includes("e") ? 1 : 0
    const dy = id.includes("n") ? -1 : id.includes("s") ? 1 : 0
    const corner = dx !== 0 && dy !== 0
    const inset = corner ? radius * (1 - Math.SQRT1_2) : 0
    const scale = shape.type === "ellipse" && corner ? Math.SQRT1_2 : 1
    return {
      id,
      point: {
        x:
          center.x +
          dx * (shape.type === "ellipse" ? (b.w / 2) * scale : b.w / 2 - inset),
        y:
          center.y +
          dy * (shape.type === "ellipse" ? (b.h / 2) * scale : b.h / 2 - inset),
      },
    }
  })
}

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value))

/** Closest ellipse point in the first quadrant, including points inside it. */
function closestEllipsePoint(
  px: number,
  py: number,
  rx: number,
  ry: number
): Point {
  if (rx < 1e-9) return { x: 0, y: clamp(py, 0, ry) }
  if (ry < 1e-9) return { x: clamp(px, 0, rx), y: 0 }

  // The distance derivative divided by sin(theta) cos(theta) is monotonic.
  // Bisecting it finds the global minimum without unstable Newton steps at
  // the axes or the center of very flat ellipses.
  let low = 0
  let high = Math.PI / 2
  for (let i = 0; i < 60; i++) {
    const theta = (low + high) / 2
    const derivative =
      ry * ry -
      rx * rx +
      (rx * px) / Math.cos(theta) -
      (ry * py) / Math.sin(theta)
    if (derivative < 0) low = theta
    else high = theta
  }
  const theta = (low + high) / 2
  return { x: rx * Math.cos(theta), y: ry * Math.sin(theta) }
}

/** Nearest point on the actual ellipse or rounded rectangle perimeter. */
function closestOutlinePoint(
  shape: Shape,
  pointer: Point,
  toward?: Point
): Point {
  const b = getShapeBounds(shape)
  const center = shapeCenter(shape)
  const rx = Math.max(0, b.w / 2)
  const ry = Math.max(0, b.h / 2)
  if (
    Math.hypot(pointer.x - center.x, pointer.y - center.y) < 1e-9 &&
    toward &&
    Math.hypot(toward.x - center.x, toward.y - center.y) > 1e-9
  ) {
    return closestOutlinePoint(shape, edgePoint(shape, toward, 0))
  }
  const sx =
    (pointer.x - center.x || (toward?.x ?? center.x) - center.x) < 0 ? -1 : 1
  const sy =
    (pointer.y - center.y || (toward?.y ?? center.y) - center.y) < 0 ? -1 : 1
  const px = Math.abs(pointer.x - center.x)
  const py = Math.abs(pointer.y - center.y)
  let point: Point
  if (shape.type === "ellipse") {
    point = closestEllipsePoint(px, py, rx, ry)
  } else {
    const radius = Math.min(6, rx / 2, ry / 2)
    const arcX = rx - radius
    const arcY = ry - radius
    const theta = clamp(Math.atan2(py - arcY, px - arcX), 0, Math.PI / 2)
    const candidates = [
      { x: clamp(px, 0, arcX), y: ry },
      { x: rx, y: clamp(py, 0, arcY) },
      {
        x: arcX + radius * Math.cos(theta),
        y: arcY + radius * Math.sin(theta),
      },
    ]
    point = candidates[0]
    let bestDistance = Infinity
    let bestDirection = -Infinity
    for (const candidate of candidates) {
      const distance = Math.hypot(candidate.x - px, candidate.y - py)
      const direction = toward
        ? candidate.x * sx * (toward.x - center.x) +
          candidate.y * sy * (toward.y - center.y)
        : 0
      if (
        distance < bestDistance - 1e-9 ||
        (Math.abs(distance - bestDistance) < 1e-9 && direction > bestDirection)
      ) {
        point = candidate
        bestDistance = distance
        bestDirection = direction
      }
    }
  }
  return { x: center.x + sx * point.x, y: center.y + sy * point.y }
}

/** Snap near a named point; otherwise attach exactly where the pointer meets the edge. */
export function getBindingAnchor(
  shape: Shape,
  pointer: Point,
  zoom: number,
  toward?: Point
): { anchor: BindingAnchor; point: Point; snapPointId?: BindingPointId } {
  let point = closestOutlinePoint(shape, pointer, toward)
  let snapPointId: BindingPointId | undefined
  const center = shapeCenter(shape)
  const directionalCenter =
    toward &&
    Math.hypot(pointer.x - center.x, pointer.y - center.y) < 1e-9 &&
    Math.hypot(toward.x - center.x, toward.y - center.y) > 1e-9
  // At an ambiguous center, preserve the chosen direction even when every
  // point on a small node is within the cursor's snap radius.
  const snapReference = directionalCenter ? point : pointer
  let bestDistance = directionalCenter ? 1e-9 : getBindingMargin(zoom)
  for (const candidate of getBindingPoints(shape)) {
    // Use the cursor itself so an arbitrary edge doesn't snap merely because
    // its projection happens to fall near a point while deep inside a node.
    const distance = Math.hypot(
      candidate.point.x - snapReference.x,
      candidate.point.y - snapReference.y
    )
    if (distance <= bestDistance) {
      point = candidate.point
      snapPointId = candidate.id
      bestDistance = distance
    }
  }
  const b = getShapeBounds(shape)
  const anchor: BindingAnchor = {
    x: b.w > 0 ? (point.x - b.x) / b.w : 0.5,
    y: b.h > 0 ? (point.y - b.y) / b.h : 0.5,
    ...(snapPointId ? { snap: snapPointId } : {}),
  }
  return { anchor, point, snapPointId }
}

/** Resolve a persisted attachment after its node moves or changes dimensions. */
export function resolveBindingAnchor(
  shape: Shape,
  anchor: BindingAnchor
): Point {
  if (anchor.snap) {
    const snap = getBindingPoints(shape).find(
      (candidate) => candidate.id === anchor.snap
    )
    if (snap) return snap.point
  }
  const b = getShapeBounds(shape)
  return closestOutlinePoint(shape, {
    x: b.x + clamp(anchor.x, 0, 1) * b.w,
    y: b.y + clamp(anchor.y, 0, 1) * b.h,
  })
}

/** Topmost bindable shape at (or within `margin` of) a point. */
export function bindTargetAt(
  point: Point,
  shapes: Array<Shape>,
  margin = 8,
  excludeId?: string
): Shape | undefined {
  for (let i = shapes.length - 1; i >= 0; i--) {
    const s = shapes[i]
    if (!isBindable(s) || s.id === excludeId) continue
    const b = getShapeBounds(s)
    const px = Math.abs(point.x - (b.x + b.w / 2))
    const py = Math.abs(point.y - (b.y + b.h / 2))
    const rx = Math.max(b.w / 2, 1e-6)
    const ry = Math.max(b.h / 2, 1e-6)
    if (Math.hypot(Math.max(0, px - rx), Math.max(0, py - ry)) > margin) {
      continue
    }
    if (s.type !== "ellipse" || Math.hypot(px / rx, py / ry) <= 1) return s

    const closest = closestEllipsePoint(px, py, rx, ry)
    if (Math.hypot(px - closest.x, py - closest.y) <= margin + 1e-6) return s
  }
  return undefined
}

/** Where a ray from the shape's center toward `toward` exits the shape, pushed out by `gap`. */
export function edgePoint(shape: Shape, toward: Point, gap = BIND_GAP): Point {
  const b = getShapeBounds(shape)
  const cx = b.x + b.w / 2
  const cy = b.y + b.h / 2
  const dx = toward.x - cx
  const dy = toward.y - cy
  const len = Math.hypot(dx, dy)
  if (len < 1e-6) return { x: cx, y: cy }
  const t =
    shape.type === "ellipse"
      ? 1 /
        Math.hypot(dx / Math.max(b.w / 2, 1e-6), dy / Math.max(b.h / 2, 1e-6))
      : Math.min(
          b.w / 2 / Math.max(Math.abs(dx), 1e-6),
          b.h / 2 / Math.max(Math.abs(dy), 1e-6)
        )
  const k = t + gap / len
  return { x: cx + dx * k, y: cy + dy * k }
}

function shapeCenter(shape: Shape): Point {
  const b = getShapeBounds(shape)
  return { x: b.x + b.w / 2, y: b.y + b.h / 2 }
}

/** Re-derive a line's endpoints from the shapes it is latched onto. */
export function layoutBoundLine(
  line: LineShape,
  getShape: (id: string) => Shape | undefined
): LineShape {
  const start = line.startBinding ? getShape(line.startBinding) : undefined
  const end = line.endBinding ? getShape(line.endBinding) : undefined
  if (!start && !end) return line
  let p1: Point = { x: line.x, y: line.y }
  let p2: Point = { x: line.x + line.dx, y: line.y + line.dy }
  if (start && line.startAnchor)
    p1 = resolveBindingAnchor(start, line.startAnchor)
  if (end && line.endAnchor) p2 = resolveBindingAnchor(end, line.endAnchor)
  const ref1 = start && !line.startAnchor ? shapeCenter(start) : p1
  const ref2 = end && !line.endAnchor ? shapeCenter(end) : p2
  if (start && !line.startAnchor) p1 = edgePoint(start, ref2)
  if (end && !line.endAnchor) p2 = edgePoint(end, ref1)
  return { ...line, x: p1.x, y: p1.y, dx: p2.x - p1.x, dy: p2.y - p1.y }
}

/** `changed` shapes plus every line latched to (or within) them, re-laid out. */
export function updateBoundLines(
  changed: Array<Shape>,
  all: Array<Shape>
): Array<Shape> {
  const changedById = new Map(changed.map((s) => [s.id, s]))
  const allById = new Map(all.map((s) => [s.id, s]))
  const get = (id: string) => changedById.get(id) ?? allById.get(id)
  const out = new Map(changedById)
  for (const s of all) {
    const cur = changedById.get(s.id) ?? s
    if (cur.type !== "line" && cur.type !== "arrow") continue
    if (!cur.startBinding && !cur.endBinding) continue
    const affected =
      changedById.has(cur.id) ||
      (cur.startBinding != null && changedById.has(cur.startBinding)) ||
      (cur.endBinding != null && changedById.has(cur.endBinding))
    if (affected) out.set(cur.id, layoutBoundLine(cur, get))
  }
  return [...out.values()]
}

/** Snap an offset vector to the nearest multiple of `step` radians. */
export function snapAngle(dx: number, dy: number, step: number): Point {
  const len = Math.hypot(dx, dy)
  if (len === 0) return { x: 0, y: 0 }
  const angle = Math.round(Math.atan2(dy, dx) / step) * step
  return { x: Math.cos(angle) * len, y: Math.sin(angle) * len }
}
