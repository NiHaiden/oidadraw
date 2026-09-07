import { describe, expect, it } from "vitest"
import {
  bindTargetAt,
  boxFromPoints,
  edgePoint,
  layoutBoundLine,
  updateBoundLines,
  boxesIntersect,
  getCommonBounds,
  getBindingAnchor,
  getBindingMargin,
  getBindingPoints,
  getShapeBounds,
  resolveBindingAnchor,
  resizeBox,
  resizeShape,
  snapAngle,
} from "./geometry"
import type { DrawShape, LineShape, RectShape } from "./types"

const rect: RectShape = {
  id: "r1",
  type: "rect",
  order: 1,
  color: "black",
  size: "m",
  fill: "none",
  x: 10,
  y: 20,
  w: 100,
  h: 50,
}

const arrow: LineShape = {
  id: "a1",
  type: "arrow",
  order: 2,
  color: "black",
  size: "m",
  x: 200,
  y: 100,
  dx: -50,
  dy: 30,
}

describe("getShapeBounds", () => {
  it("returns bounds for rects", () => {
    expect(getShapeBounds(rect)).toEqual({ x: 10, y: 20, w: 100, h: 50 })
  })

  it("normalizes negative deltas for lines and arrows", () => {
    // regression: arrows crashed here when the switch only matched "line"
    expect(getShapeBounds(arrow)).toEqual({ x: 150, y: 100, w: 50, h: 30 })
    expect(getShapeBounds({ ...arrow, type: "line" })).toEqual(
      getShapeBounds(arrow)
    )
  })
})

describe("getCommonBounds", () => {
  it("unions bounds across shapes", () => {
    expect(getCommonBounds([rect, arrow])).toEqual({
      x: 10,
      y: 20,
      w: 190,
      h: 110,
    })
  })

  it("returns null for empty input", () => {
    expect(getCommonBounds([])).toBeNull()
  })
})

describe("boxes", () => {
  it("boxFromPoints normalizes", () => {
    expect(boxFromPoints({ x: 5, y: 8 }, { x: 1, y: 2 })).toEqual({
      x: 1,
      y: 2,
      w: 4,
      h: 6,
    })
  })

  it("boxesIntersect detects overlap and separation", () => {
    const a = { x: 0, y: 0, w: 10, h: 10 }
    expect(boxesIntersect(a, { x: 5, y: 5, w: 10, h: 10 })).toBe(true)
    expect(boxesIntersect(a, { x: 20, y: 0, w: 5, h: 5 })).toBe(false)
  })

  it("resizeBox drags a corner and never inverts", () => {
    const from = { x: 0, y: 0, w: 100, h: 100 }
    expect(resizeBox(from, "se", { x: 150, y: 120 })).toEqual({
      x: 0,
      y: 0,
      w: 150,
      h: 120,
    })
    const collapsed = resizeBox(from, "se", { x: -500, y: -500 })
    expect(collapsed.w).toBeGreaterThanOrEqual(1)
    expect(collapsed.h).toBeGreaterThanOrEqual(1)
  })
})

describe("resizeShape", () => {
  const from = { x: 0, y: 0, w: 100, h: 100 }
  const to = { x: 0, y: 0, w: 200, h: 50 }

  it("scales rects", () => {
    const s: RectShape = { ...rect, x: 10, y: 10, w: 50, h: 50 }
    expect(resizeShape(s, from, to)).toMatchObject({
      x: 20,
      y: 5,
      w: 100,
      h: 25,
    })
  })

  it("scales line deltas", () => {
    const s: LineShape = { ...arrow, x: 10, y: 10, dx: 40, dy: 40 }
    expect(resizeShape(s, from, to)).toMatchObject({
      x: 20,
      y: 5,
      dx: 80,
      dy: 20,
    })
  })

  it("scales draw points", () => {
    const s: DrawShape = {
      id: "d1",
      type: "draw",
      order: 3,
      color: "black",
      size: "m",
      x: 0,
      y: 0,
      w: 100,
      h: 100,
      points: [0, 0, 100, 100],
    }
    expect(resizeShape(s, from, to)).toMatchObject({
      points: [0, 0, 200, 50],
    })
  })
})

describe("snapAngle", () => {
  it("snaps to 45 degree steps preserving length", () => {
    const snapped = snapAngle(10, 1, Math.PI / 4)
    expect(snapped.y).toBeCloseTo(0)
    expect(snapped.x).toBeCloseTo(Math.hypot(10, 1))
  })

  it("handles zero vectors", () => {
    expect(snapAngle(0, 0, Math.PI / 4)).toEqual({ x: 0, y: 0 })
  })
})

describe("arrow binding", () => {
  it("places eight snap points on ellipse and rounded rectangle outlines", () => {
    const ellipse = { ...rect, type: "ellipse" as const }
    const points = getBindingPoints(ellipse)
    expect(points).toHaveLength(8)
    expect(points.find((p) => p.id === "s")?.point).toEqual({ x: 60, y: 70 })
    for (const { point } of points) {
      expect(
        ((point.x - 60) / 50) ** 2 + ((point.y - 45) / 25) ** 2
      ).toBeCloseTo(1)
    }
    const corner = getBindingPoints(rect).find((p) => p.id === "ne")!.point
    expect(corner.x).toBeLessThan(110)
    expect(corner.y).toBeGreaterThan(20)
    expect(Math.hypot(corner.x - 104, corner.y - 26)).toBeCloseTo(6)
  })

  it.each([0.5, 1, 4, 8])(
    "snaps to named points within twelve screen pixels at zoom %s",
    (zoom) => {
      const node = { ...rect, w: 500, h: 300 }
      const point = { x: 260, y: 20 }
      const snapped = getBindingAnchor(
        node,
        { x: point.x + 11 / zoom, y: point.y },
        zoom
      )
      expect(snapped.snapPointId).toBe("n")
      expect(snapped.anchor).toEqual({ x: 0.5, y: 0, snap: "n" })
      expect(snapped.point).toEqual(point)
      const free = getBindingAnchor(
        node,
        { x: point.x + 13 / zoom, y: point.y },
        zoom
      )
      expect(free.snapPointId).toBeUndefined()
      expect(free.point).toEqual({ x: point.x + 13 / zoom, y: point.y })
    }
  )

  it("attaches at the nearest rectangle edge without a gap or center alignment", () => {
    const outside = getBindingAnchor(rect, { x: 37, y: 14 }, 1)
    const inside = getBindingAnchor(rect, { x: 37, y: 30 }, 1)
    expect(outside.point).toEqual({ x: 37, y: 20 })
    expect(inside.point).toEqual(outside.point)
    expect(outside.snapPointId).toBeUndefined()
    expect(inside.snapPointId).toBeUndefined()
  })

  it("does not create a named snap from a pointer deep inside a node", () => {
    const node = { ...rect, w: 500, h: 300 }
    const attachment = getBindingAnchor(node, { x: 262, y: 70 }, 1)
    expect(attachment.snapPointId).toBeUndefined()
    expect(attachment.point).toEqual({ x: 262, y: 20 })
  })

  it.each([-5, 5])(
    "finds the closest ellipse outline from an offset of %s",
    (offset) => {
      const ellipse = {
        ...rect,
        type: "ellipse" as const,
        x: 0,
        y: 0,
        w: 400,
        h: 160,
      }
      const theta = 0.35
      const edge = {
        x: 200 + 200 * Math.cos(theta),
        y: 80 + 80 * Math.sin(theta),
      }
      const nx = Math.cos(theta) / 200
      const ny = Math.sin(theta) / 80
      const normalLength = Math.hypot(nx, ny)
      const attachment = getBindingAnchor(
        ellipse,
        {
          x: edge.x + (offset * nx) / normalLength,
          y: edge.y + (offset * ny) / normalLength,
        },
        1
      )
      expect(attachment.snapPointId).toBeUndefined()
      expect(attachment.point.x).toBeCloseTo(edge.x, 8)
      expect(attachment.point.y).toBeCloseTo(edge.y, 8)
    }
  )

  it("finds the nearest ellipse edge from an interior axis, instead of projecting radially", () => {
    const ellipse = {
      ...rect,
      type: "ellipse" as const,
      x: 0,
      y: 0,
      w: 400,
      h: 40,
    }
    const attachment = getBindingAnchor(ellipse, { x: 250, y: 20 }, 1)
    expect(attachment.point.x).toBeCloseTo(
      200 + (200 ** 2 * 50) / (200 ** 2 - 20 ** 2)
    )
    expect(attachment.point.y).toBeGreaterThan(39)
    expect(
      ((attachment.point.x - 200) / 200) ** 2 +
        ((attachment.point.y - 20) / 20) ** 2
    ).toBeCloseTo(1)
  })

  it("uses the opposite endpoint for an ambiguous center attachment", () => {
    const ellipse = { ...rect, type: "ellipse" as const }
    const attachment = getBindingAnchor(ellipse, { x: 60, y: 45 }, 1, {
      x: 60,
      y: -200,
    })
    expect(attachment.point.x).toBeCloseTo(60)
    expect(attachment.point.y).toBeCloseTo(20)
    expect(attachment.snapPointId).toBe("n")
  })

  it.each(["rect", "ellipse"] as const)(
    "preserves the direction of a centered start on a small %s",
    (type) => {
      const small = { ...rect, type, x: 0, y: 0, w: 20, h: 10 }
      const center = { x: 10, y: 5 }
      const east = getBindingAnchor(small, center, 1, { x: 200, y: 5 })
      expect(east.point).toEqual({ x: 20, y: 5 })
      expect(east.snapPointId).toBe("e")
      const toward = { x: 200, y: 45 }
      const diagonal = getBindingAnchor(small, center, 1, toward)
      expect(diagonal.snapPointId).toBeUndefined()
      expect(diagonal.point.x).toBeGreaterThan(18)
      expect(diagonal.point.y).toBeGreaterThan(5)
      const onEdge = edgePoint(small, toward, 0)
      expect(diagonal.point.x).toBeCloseTo(onEdge.x)
      expect(diagonal.point.y).toBeCloseTo(onEdge.y)
    }
  )

  it.each([
    { w: 1, h: 1 },
    { w: 4000, h: 0.01 },
    { w: 0.01, h: 4000 },
    { w: 0, h: 0 },
  ])("handles tiny or flat ellipse dimensions %o", (size) => {
    const ellipse = { ...rect, ...size, type: "ellipse" as const }
    const attachment = getBindingAnchor(ellipse, { x: 200, y: 400 }, 8)
    expect(Number.isFinite(attachment.point.x)).toBe(true)
    expect(Number.isFinite(attachment.point.y)).toBe(true)
    expect(Number.isFinite(attachment.anchor.x)).toBe(true)
    expect(Number.isFinite(attachment.anchor.y)).toBe(true)
    const resolved = resolveBindingAnchor(ellipse, attachment.anchor)
    expect(resolved.x).toBeCloseTo(attachment.point.x)
    expect(resolved.y).toBeCloseTo(attachment.point.y)
  })

  it("keeps arbitrary attachments proportional when the node moves and resizes", () => {
    const anchor = getBindingAnchor(rect, { x: 37, y: 14 }, 1).anchor
    expect(
      resolveBindingAnchor({ ...rect, x: 110, y: 220, w: 200, h: 100 }, anchor)
    ).toEqual({ x: 164, y: 220 })
    const ellipse = { ...rect, type: "ellipse" as const, w: 400, h: 160 }
    const ellipseAnchor = getBindingAnchor(ellipse, { x: 320, y: 14 }, 4).anchor
    const resized = { ...ellipse, x: 200, y: 100, w: 300, h: 500 }
    const resolved = resolveBindingAnchor(resized, ellipseAnchor)
    expect(resolved.x).toBeCloseTo(resized.x + ellipseAnchor.x * resized.w)
    expect(resolved.y).toBeCloseTo(resized.y + ellipseAnchor.y * resized.h)
  })

  it("preserves named corners and projects free corners onto the resized rounded outline", () => {
    const corner = getBindingPoints(rect).find((p) => p.id === "ne")!.point
    const anchor = getBindingAnchor(rect, corner, 1).anchor
    const small = { ...rect, w: 20, h: 10 }
    expect(resolveBindingAnchor(small, anchor)).toEqual(
      getBindingPoints(small).find((p) => p.id === "ne")!.point
    )
    const free = getBindingAnchor(
      rect,
      { x: 104 + 6 * Math.cos(0.3), y: 26 - 6 * Math.sin(0.3) },
      100
    ).anchor
    expect(free.snap).toBeUndefined()
    const resolved = resolveBindingAnchor(small, free)
    expect(Math.hypot(resolved.x - 27.5, resolved.y - 22.5)).toBeCloseTo(2.5)
  })

  it("keeps an explicit anchor fixed while the opposite endpoint is dragged", () => {
    const anchor = getBindingAnchor(rect, { x: 37, y: 14 }, 1).anchor
    const bound: LineShape = {
      ...arrow,
      startBinding: rect.id,
      startAnchor: anchor,
    }
    const first = layoutBoundLine(bound, () => rect)
    const moved = layoutBoundLine({ ...first, dx: 500, dy: 600 }, () => rect)
    expect({ x: moved.x, y: moved.y }).toEqual({ x: 37, y: 20 })
    expect(moved.x + moved.dx).toBe(537)
    expect(moved.y + moved.dy).toBe(620)
  })

  it("resolves both explicit anchors independently and aims a legacy end toward a fixed anchor", () => {
    const other = { ...rect, id: "other", x: 250, y: 100 }
    const startAnchor = getBindingAnchor(rect, { x: 37, y: 14 }, 1).anchor
    const endAnchor = getBindingAnchor(other, { x: 280, y: 90 }, 1).anchor
    const get = (id: string) => (id === rect.id ? rect : other)
    const bound: LineShape = {
      ...arrow,
      startBinding: rect.id,
      startAnchor,
      endBinding: other.id,
      endAnchor,
    }
    const both = layoutBoundLine(bound, get)
    expect({ x: both.x, y: both.y }).toEqual({ x: 37, y: 20 })
    expect({ x: both.x + both.dx, y: both.y + both.dy }).toEqual({
      x: 280,
      y: 100,
    })
    const mixed = layoutBoundLine({ ...bound, endAnchor: undefined }, get)
    const expectedEnd = edgePoint(other, { x: 37, y: 20 })
    expect(mixed.x + mixed.dx).toBeCloseTo(expectedEnd.x)
    expect(mixed.y + mixed.dy).toBeCloseTo(expectedEnd.y)
  })

  it("finds the topmost eligible node underneath an excluded target", () => {
    const front = { ...rect, id: "front", order: 3 }
    const point = { x: 60, y: 45 }
    expect(bindTargetAt(point, [rect, front, arrow])).toBe(front)
    expect(bindTargetAt(point, [rect, front, arrow], 8, front.id)).toBe(rect)
    expect(bindTargetAt(point, [rect], 8, rect.id)).toBeUndefined()
  })

  it("does not attach to empty corners of an ellipse's bounding box", () => {
    const ellipse = { ...rect, id: "ellipse", type: "ellipse" as const }
    expect(bindTargetAt({ x: 110, y: 70 }, [ellipse])).toBeUndefined()
    expect(bindTargetAt({ x: 110, y: 70 }, [rect, ellipse])).toBe(rect)
    expect(bindTargetAt({ x: 60, y: 45 }, [ellipse])).toBe(ellipse)
    expect(bindTargetAt({ x: 118, y: 45 }, [ellipse])).toBe(ellipse)
    expect(bindTargetAt({ x: 119, y: 45 }, [ellipse])).toBeUndefined()
  })

  it("measures margin from the curved edge of even a very flat ellipse", () => {
    const ellipse = {
      ...rect,
      type: "ellipse" as const,
      x: 0,
      y: 0,
      w: 400,
      h: 40,
    }
    const angle = Math.PI / 4
    const point = {
      x: 200 + 200 * Math.cos(angle),
      y: 20 + 20 * Math.sin(angle),
    }
    const nx = Math.cos(angle) / 200
    const ny = Math.sin(angle) / 20
    const length = Math.hypot(nx, ny)
    const outside = (distance: number) => ({
      x: point.x + (distance * nx) / length,
      y: point.y + (distance * ny) / length,
    })
    expect(bindTargetAt(outside(8), [ellipse], 8)).toBe(ellipse)
    expect(bindTargetAt(outside(8.1), [ellipse], 8)).toBeUndefined()
  })

  it.each([0.1, 0.5, 1, 8])("keeps a usable snap margin at zoom %s", (zoom) => {
    const margin = getBindingMargin(zoom)
    const endpoint = edgePoint(rect, { x: 300, y: 45 }, 0)
    expect(
      bindTargetAt({ x: endpoint.x + 11 / zoom, y: endpoint.y }, [rect], margin)
    ).toBe(rect)
    expect(
      bindTargetAt({ x: endpoint.x + 13 / zoom, y: endpoint.y }, [rect], margin)
    ).toBeUndefined()
  })

  // rect: x 10..110, y 20..70, center (60, 45)
  it("edgePoint exits a rect edge toward the target, plus gap", () => {
    const p = edgePoint(rect, { x: 260, y: 45 }, 6)
    expect(p).toEqual({ x: 116, y: 45 })
  })

  it("edgePoint exits an ellipse boundary", () => {
    const ellipse = { ...rect, id: "e1", type: "ellipse" as const }
    const p = edgePoint(ellipse, { x: 60, y: 245 }, 6)
    expect(p.x).toBeCloseTo(60)
    expect(p.y).toBeCloseTo(45 + 25 + 6)
  })

  it("layoutBoundLine pins the bound end to the target edge", () => {
    const bound: LineShape = {
      ...arrow,
      x: 300,
      y: 45,
      dx: -100,
      dy: 0,
      endBinding: "r1",
    }
    const laid = layoutBoundLine(bound, (id) =>
      id === "r1" ? rect : undefined
    )
    expect(laid.x).toBe(300)
    expect(laid.x + laid.dx).toBe(116) // rect right edge + gap
    expect(laid.y + laid.dy).toBe(45)
  })

  it("updateBoundLines re-lays arrows latched to a moved shape", () => {
    const bound: LineShape = {
      ...arrow,
      x: 300,
      y: 45,
      dx: -100,
      dy: 0,
      endBinding: "r1",
    }
    const movedRect = { ...rect, x: 110 } // moved 100 right, edge now at 210
    const out = updateBoundLines([movedRect], [movedRect, bound])
    const laid = out.find((s) => s.id === bound.id) as LineShape
    expect(laid.x + laid.dx).toBe(216)
  })

  it("layoutBoundLine ignores dangling bindings", () => {
    const bound: LineShape = { ...arrow, endBinding: "gone" }
    expect(layoutBoundLine(bound, () => undefined)).toEqual(bound)
  })
})
