import { describe, expect, it } from "vitest"
import {
  boxFromPoints,
  boxesIntersect,
  getCommonBounds,
  getShapeBounds,
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
