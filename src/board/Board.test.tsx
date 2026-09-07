// @vitest-environment jsdom

import { act, cleanup, fireEvent, render } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { Board } from "./Board"
import { BoardStore } from "./store"
import type {
  EllipseShape,
  LineShape,
  RectShape,
  Shape,
} from "@kritzlboard/core"

// Keep the real Yjs store and subscriptions without opening a sync connection.
vi.mock("y-websocket", async () => {
  const { Awareness } = await import("y-protocols/awareness")
  return {
    WebsocketProvider: class {
      awareness: InstanceType<typeof Awareness>
      constructor(
        _url: string,
        _room: string,
        doc: ConstructorParameters<typeof Awareness>[0]
      ) {
        this.awareness = new Awareness(doc)
      }
      on() {}
      destroy() {
        this.awareness.destroy()
      }
    },
  }
})

vi.mock("./TopBar", () => ({ TopBar: () => null }))
vi.mock("./Toolbar", () => ({ Toolbar: () => null }))
vi.mock("./StylePanel", () => ({ StylePanel: () => null }))
vi.mock("./ZoomBar", () => ({ ZoomBar: () => null }))

const source: RectShape = {
  id: "source",
  type: "rect",
  order: 1,
  color: "black",
  size: "m",
  fill: "none",
  x: -200,
  y: -50,
  w: 100,
  h: 100,
}
const target: RectShape = { ...source, id: "target", order: 2, x: 100 }
const ellipse: EllipseShape = {
  ...target,
  id: "ellipse",
  type: "ellipse",
  y: -100,
  w: 200,
  h: 200,
}
const arrow: LineShape = {
  id: "connector",
  type: "arrow",
  order: 3,
  color: "black",
  size: "m",
  x: -94,
  y: 0,
  dx: 188,
  dy: 0,
  startBinding: source.id,
  endBinding: target.id,
}

let store: BoardStore

beforeEach(() => {
  // Node's optional localStorage can mask jsdom's storage in newer runtimes.
  vi.stubGlobal("localStorage", { getItem: () => null, setItem: vi.fn() })
  store = new BoardStore("interaction-test")
})

afterEach(() => {
  cleanup()
  store.destroy()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  Reflect.deleteProperty(document, "elementsFromPoint")
})

function mountBoard(shapes: Array<Shape>) {
  store.putShapes(shapes)
  const view = render(<Board store={store} />)
  const canvas = view.container.querySelector<SVGSVGElement>(".board-canvas")!
  let zoom = 1
  vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue(
    new DOMRect(0, 0, window.innerWidth, window.innerHeight)
  )
  // jsdom does not implement pointer capture; events below explicitly target
  // the canvas after pointerdown, as capture would in the browser.
  canvas.setPointerCapture = vi.fn()
  canvas.hasPointerCapture = vi.fn(() => true)
  canvas.releasePointerCapture = vi.fn()

  function pointer(
    kind: "down" | "move" | "up",
    element: Element,
    x: number,
    y: number
  ) {
    const event = {
      pointerId: 1,
      button: 0,
      buttons: kind === "up" ? 0 : 1,
      clientX: window.innerWidth / 2 + x * zoom,
      clientY: window.innerHeight / 2 + y * zoom,
    }
    if (kind === "down") fireEvent.pointerDown(element, event)
    else if (kind === "move") fireEvent.pointerMove(element, event)
    else fireEvent.pointerUp(element, event)
  }

  function shapeElement(id: string) {
    return view.container.querySelector(`[data-shape-id="${id}"]`)!
  }

  function select(id: string, x: number, y: number) {
    pointer("down", shapeElement(id), x, y)
    pointer("up", canvas, x, y)
  }

  function endpoint(which: "start" | "end") {
    const handle = view.container.querySelector(`[data-line-handle="${which}"]`)
    expect(
      handle,
      `The selected connector exposes its ${which} handle`
    ).not.toBeNull()
    return handle!
  }

  function connector() {
    const shape = store
      .getShapes()
      .find((item) => item.type === "line" || item.type === "arrow")
    expect(shape).toBeDefined()
    return shape as LineShape
  }

  function setZoom(next: number) {
    fireEvent.wheel(canvas, {
      clientX: window.innerWidth / 2,
      clientY: window.innerHeight / 2,
      ctrlKey: true,
      deltaY: -Math.log(next / zoom) / 0.0022,
    })
    zoom = next
  }

  return {
    ...view,
    canvas,
    pointer,
    select,
    endpoint,
    connector,
    shapeElement,
    setZoom,
  }
}

describe("connector interaction", () => {
  it.each(["line", "arrow"] as const)(
    "keeps both endpoint handles after clicking a labeled %s",
    (type) => {
      const board = mountBoard([
        source,
        target,
        { ...arrow, type, text: "Connects" },
      ])
      board.select(arrow.id, 0, 0)

      board.endpoint("start")
      board.endpoint("end")
      expect(board.container.querySelector("[contenteditable]")).toBeNull()

      fireEvent.keyDown(window, { key: "Enter" })
      expect(board.container.querySelector("[contenteditable]")).not.toBeNull()
      expect(board.container.querySelector("[data-line-handle]")).toBeNull()
    }
  )

  it.each(["l", "a"])(
    "attaches a new connector using its release position (%s shortcut)",
    (key) => {
      const board = mountBoard([source, target])
      fireEvent.keyDown(window, { key })
      board.pointer("down", board.canvas, -150, 0)
      board.pointer("move", board.canvas, 20, 0)
      expect(board.connector().endBinding).toBeUndefined()

      board.pointer("up", board.canvas, 150, 0)

      expect(board.connector()).toMatchObject({
        startBinding: source.id,
        endBinding: target.id,
      })
      expect(board.connector().x + board.connector().dx).toBeCloseTo(100)
      board.endpoint("end")
    }
  )

  it("detaches and reattaches an endpoint, then follows node movement and resizing", () => {
    const board = mountBoard([source, target, arrow])
    board.select(arrow.id, 0, 0)
    board.pointer("down", board.endpoint("end"), 94, 0)
    board.pointer("move", board.canvas, 0, 140)
    board.pointer("up", board.canvas, 0, 140)
    expect(board.connector()).toMatchObject({ startBinding: source.id })
    expect(board.connector().endBinding).toBeUndefined()
    expect(board.connector().x + board.connector().dx).toBeCloseTo(0)
    expect(board.connector().y + board.connector().dy).toBeCloseTo(140)

    board.pointer("down", board.endpoint("end"), 0, 140)
    board.pointer("move", board.canvas, 20, 80)
    board.pointer("up", board.canvas, 150, 0)
    expect(board.connector()).toMatchObject({
      startBinding: source.id,
      endBinding: target.id,
    })

    board.pointer("down", board.shapeElement(target.id), 150, 0)
    board.pointer("move", board.canvas, 230, 0)
    board.pointer("up", board.canvas, 230, 0)
    expect(store.getShape(target.id)).toMatchObject({ x: 180 })
    expect(board.connector().x + board.connector().dx).toBeCloseTo(180)

    const westHandle = board.container.querySelector('[data-resize-handle="w"]')
    expect(westHandle).not.toBeNull()
    board.pointer("down", westHandle!, 180, 0)
    board.pointer("move", board.canvas, 140, 0)
    board.pointer("up", board.canvas, 140, 0)
    expect(store.getShape(target.id)).toMatchObject({ x: 140, w: 140 })
    expect(board.connector().endBinding).toBe(target.id)
    expect(board.connector().x + board.connector().dx).toBeCloseTo(140)
  })

  it("removes the binding when release finishes outside the node after a snapped move", () => {
    const board = mountBoard([source, target, arrow])
    board.select(arrow.id, 0, 0)
    board.pointer("down", board.endpoint("end"), 94, 0)
    board.pointer("move", board.canvas, 150, 0)
    expect(board.connector().endBinding).toBe(target.id)
    expect(board.connector().endAnchor).toBeDefined()

    board.pointer("up", board.canvas, 0, 140)

    expect(board.connector().endBinding).toBeUndefined()
    expect(board.connector().endAnchor).toBeUndefined()
    expect(board.connector().x + board.connector().dx).toBeCloseTo(0)
    expect(board.connector().y + board.connector().dy).toBeCloseTo(140)
  })

  it("reattaches the start handle to a different node while preserving the end binding", () => {
    const replacement = { ...source, id: "replacement", y: 150, order: 4 }
    const board = mountBoard([source, target, arrow, replacement])
    board.select(arrow.id, 0, 0)
    board.pointer("down", board.endpoint("start"), -94, 0)
    board.pointer("move", board.canvas, 0, 140)
    expect(board.connector().startBinding).toBeUndefined()
    expect(board.connector().endBinding).toBe(target.id)

    board.pointer("up", board.canvas, -150, 200)

    expect(board.connector()).toMatchObject({
      startBinding: replacement.id,
      endBinding: target.id,
    })
    expect(board.connector().y).toBeGreaterThan(150)
    expect(board.connector().y).toBeLessThan(250)
  })

  it("offers resize handles on a single node click while double-click still edits its label", () => {
    const board = mountBoard([source])
    board.select(source.id, -150, 0)
    expect(
      board.container.querySelectorAll("[data-resize-handle]")
    ).toHaveLength(8)
    expect(board.container.querySelector("[contenteditable]")).toBeNull()

    document.elementsFromPoint = vi.fn(() => [board.shapeElement(source.id)])
    fireEvent.doubleClick(board.canvas, {
      clientX: window.innerWidth / 2 - 150,
      clientY: window.innerHeight / 2,
    })
    expect(board.container.querySelector("[contenteditable]")).not.toBeNull()
    expect(board.container.querySelector("[data-resize-handle]")).toBeNull()
  })

  it("can attach just outside a small on-screen node when zoomed out", () => {
    const board = mountBoard([source, target])
    board.setZoom(0.25)
    fireEvent.keyDown(window, { key: "a" })
    board.pointer("down", board.canvas, -150, 0)
    // Twenty-eight world units is only seven screen pixels from the node.
    board.pointer("move", board.canvas, 72, 0)
    board.pointer("up", board.canvas, 72, 0)
    expect(board.connector()).toMatchObject({
      startBinding: source.id,
      endBinding: target.id,
    })
  })

  it("retains a bound endpoint when re-grabbed at high zoom", () => {
    const board = mountBoard([source, target, arrow])
    board.setZoom(8)
    board.select(arrow.id, 0, 0)
    board.pointer("down", board.endpoint("end"), 94, 0)
    board.pointer("move", board.canvas, 94, 0)
    board.pointer("up", board.canvas, 94, 0)
    expect(board.connector().endBinding).toBe(target.id)
  })

  it("finds an eligible node beneath the node already attached to the opposite end", () => {
    const overlappingSource = { ...source, x: 100, order: 3 }
    const board = mountBoard([target, overlappingSource])
    fireEvent.keyDown(window, { key: "a" })
    board.pointer("down", board.canvas, 150, 0)
    board.pointer("move", board.canvas, 160, 0)
    board.pointer("up", board.canvas, 160, 0)
    expect(board.connector()).toMatchObject({
      startBinding: source.id,
      endBinding: target.id,
    })
  })

  it.each(["l", "a"])(
    "shows connection points when hovering a node with the %s shortcut",
    (key) => {
      const board = mountBoard([ellipse])
      fireEvent.keyDown(window, { key })

      board.pointer("move", board.canvas, 205, 104)

      const overlay = board.container.querySelector(
        `[data-binding-target="${ellipse.id}"]`
      )
      expect(overlay).not.toBeNull()
      expect(overlay!.querySelectorAll("[data-binding-point]")).toHaveLength(8)
      expect(overlay!.querySelector('[data-binding-point="s"]')).not.toBeNull()
      expect(
        board.container.querySelector('[data-binding-anchor="snapped"]')
      ).not.toBeNull()

      board.pointer("move", board.canvas, 400, 200)
      expect(board.container.querySelector("[data-binding-target]")).toBeNull()
    }
  )

  it("snaps an arrow to the ellipse's south point when released nearby", () => {
    const board = mountBoard([ellipse])
    fireEvent.keyDown(window, { key: "a" })
    board.pointer("down", board.canvas, 200, 260)
    board.pointer("move", board.canvas, 205, 104)
    expect(
      board.container.querySelector('[data-binding-anchor="snapped"]')
    ).not.toBeNull()

    board.pointer("up", board.canvas, 205, 104)

    expect(board.connector()).toMatchObject({
      endBinding: ellipse.id,
      endAnchor: { x: 0.5, y: 1, snap: "s" },
    })
    expect(board.connector().x + board.connector().dx).toBeCloseTo(200)
    expect(board.connector().y + board.connector().dy).toBeCloseTo(100)
  })

  it("creates an outward arrow when clicking a node's south snap point without dragging", () => {
    const board = mountBoard([ellipse])
    fireEvent.keyDown(window, { key: "a" })

    board.pointer("down", board.canvas, 205, 104)
    board.pointer("up", board.canvas, 205, 104)

    expect(board.connector()).toMatchObject({
      startBinding: ellipse.id,
      startAnchor: { x: 0.5, y: 1, snap: "s" },
      x: 200,
      y: 100,
    })
    expect(board.connector().dx).toBeCloseTo(0)
    expect(board.connector().dy).toBeCloseTo(120)
    expect(board.connector().endBinding).toBeUndefined()
    expect(board.connector().endAnchor).toBeUndefined()
  })

  it("creates an outward arrow from the right edge when clicking a wide ellipse's center", () => {
    const oval: EllipseShape = { ...ellipse, y: -80, w: 320, h: 160 }
    const board = mountBoard([oval])
    fireEvent.keyDown(window, { key: "a" })

    board.pointer("down", board.canvas, 260, 0)
    board.pointer("up", board.canvas, 260, 0)

    expect(board.connector()).toMatchObject({
      startBinding: oval.id,
      startAnchor: { x: 1, y: 0.5 },
    })
    expect(board.connector().x).toBeCloseTo(420)
    expect(board.connector().y).toBeCloseTo(0)
    expect(board.connector().dx).toBeCloseTo(120)
    expect(board.connector().dy).toBeCloseTo(0)
    expect(board.connector().endBinding).toBeUndefined()
  })

  it("still creates a horizontal arrow when clicking empty canvas without dragging", () => {
    const board = mountBoard([ellipse])
    fireEvent.keyDown(window, { key: "a" })

    board.pointer("down", board.canvas, 400, 200)
    board.pointer("up", board.canvas, 400, 200)

    expect(board.connector()).toMatchObject({ x: 400, y: 200, dx: 120, dy: 0 })
    expect(board.connector().startBinding).toBeUndefined()
    expect(board.connector().startAnchor).toBeUndefined()
  })

  it("attaches between snap points on the actual ellipse edge", () => {
    const oval: EllipseShape = { ...ellipse, y: -80, w: 320, h: 160 }
    const board = mountBoard([oval])
    const edge = {
      x: 260 + 160 * Math.cos(Math.PI / 8),
      y: 80 * Math.sin(Math.PI / 8),
    }
    const normalX = Math.cos(Math.PI / 8) / 160
    const normalY = Math.sin(Math.PI / 8) / 80
    const normalLength = Math.hypot(normalX, normalY)
    // Aim four pixels outside the oval along its outward normal. The closest
    // outline point is `edge`, which differs from a center-directed ray.
    const pointer = {
      x: edge.x + (4 * normalX) / normalLength,
      y: edge.y + (4 * normalY) / normalLength,
    }
    fireEvent.keyDown(window, { key: "a" })
    board.pointer("down", board.canvas, 500, 190)
    board.pointer("move", board.canvas, pointer.x, pointer.y)
    expect(
      board.container.querySelector('[data-binding-anchor="edge"]')
    ).not.toBeNull()

    board.pointer("up", board.canvas, pointer.x, pointer.y)

    const attached = board.connector()
    expect(attached.endBinding).toBe(ellipse.id)
    expect(attached.endAnchor).toBeDefined()
    expect(attached.endAnchor!.snap).toBeUndefined()
    expect(attached.x + attached.dx).toBeCloseTo(edge.x)
    expect(attached.y + attached.dy).toBeCloseTo(edge.y)
    expect(attached.endAnchor!.x).toBeCloseTo((edge.x - oval.x) / oval.w)
    expect(attached.endAnchor!.y).toBeCloseTo((edge.y - oval.y) / oval.h)
  })

  it.each([0.25, 8])("snaps near the same point at zoom %s", (zoom) => {
    const board = mountBoard([ellipse])
    board.setZoom(zoom)
    fireEvent.keyDown(window, { key: "a" })
    board.pointer("down", board.canvas, 200, 260)
    // Snap tolerance is measured on screen, independent of board zoom.
    board.pointer("move", board.canvas, 200 + 6 / zoom, 100 + 2 / zoom)
    board.pointer("up", board.canvas, 200 + 6 / zoom, 100 + 2 / zoom)

    expect(board.connector()).toMatchObject({
      endBinding: ellipse.id,
      endAnchor: { x: 0.5, y: 1, snap: "s" },
    })
    expect(board.connector().x + board.connector().dx).toBeCloseTo(200)
    expect(board.connector().y + board.connector().dy).toBeCloseTo(100)
  })

  it("keeps the chosen source point fixed while aiming and reconnecting the other end", () => {
    const board = mountBoard([ellipse])
    fireEvent.keyDown(window, { key: "a" })
    board.pointer("down", board.canvas, 204, 102)
    board.pointer("move", board.canvas, -50, 240)
    expect(board.connector()).toMatchObject({
      x: 200,
      y: 100,
      startBinding: ellipse.id,
      startAnchor: { x: 0.5, y: 1, snap: "s" },
    })

    board.pointer("move", board.canvas, 430, -80)
    board.pointer("up", board.canvas, 430, -80)
    expect(board.connector()).toMatchObject({ x: 200, y: 100 })

    board.pointer("down", board.endpoint("end"), 430, -80)
    board.pointer("move", board.canvas, 0, -180)
    board.pointer("up", board.canvas, 0, -180)
    expect(board.connector()).toMatchObject({
      x: 200,
      y: 100,
      startAnchor: { x: 0.5, y: 1, snap: "s" },
    })
  })

  it("keeps the chosen source snap point when zoom changes during creation", () => {
    const board = mountBoard([ellipse])
    fireEvent.keyDown(window, { key: "a" })
    board.pointer("down", board.canvas, 205, 104)
    board.pointer("move", board.canvas, 400, 200)

    board.setZoom(8)
    board.pointer("move", board.canvas, 450, 200)
    board.pointer("up", board.canvas, 450, 200)

    expect(board.connector()).toMatchObject({
      x: 200,
      y: 100,
      startBinding: ellipse.id,
      startAnchor: { x: 0.5, y: 1, snap: "s" },
    })
  })

  it("keeps the chosen source point when a collaborator moves and resizes the node mid-drag", () => {
    const board = mountBoard([ellipse])
    fireEvent.keyDown(window, { key: "a" })
    board.pointer("down", board.canvas, 205, 104)
    board.pointer("move", board.canvas, -50, 200)

    act(() => {
      store.doc.transact(() => {
        store.yShapes.set(ellipse.id, {
          ...ellipse,
          x: 500,
          y: 300,
          w: 300,
          h: 100,
        })
      }, "remote")
    })
    expect(board.connector()).toMatchObject({ x: 650, y: 400 })

    board.pointer("move", board.canvas, -50, 220)
    board.pointer("up", board.canvas, -50, 220)

    expect(board.connector()).toMatchObject({
      x: 650,
      y: 400,
      startBinding: ellipse.id,
      startAnchor: { x: 0.5, y: 1, snap: "s" },
    })
    expect(board.connector().x + board.connector().dx).toBeCloseTo(-50)
    expect(board.connector().y + board.connector().dy).toBeCloseTo(220)
  })

  it("converts an existing endpoint to a chosen edge anchor when reattached", () => {
    const board = mountBoard([
      source,
      ellipse,
      { ...arrow, endBinding: ellipse.id },
    ])
    board.select(arrow.id, 0, 0)
    board.pointer("down", board.endpoint("end"), 94, 0)
    board.pointer("move", board.canvas, 205, 104)
    expect(
      board.container.querySelector('[data-binding-anchor="snapped"]')
    ).not.toBeNull()
    board.pointer("up", board.canvas, 205, 104)

    expect(board.connector()).toMatchObject({
      startBinding: source.id,
      endBinding: ellipse.id,
      endAnchor: { x: 0.5, y: 1, snap: "s" },
    })
    expect(board.connector().startAnchor).toBeUndefined()
    expect(board.connector().x + board.connector().dx).toBeCloseTo(200)
    expect(board.connector().y + board.connector().dy).toBeCloseTo(100)
  })

  it("clears both anchor records when moving a connector without its nodes", () => {
    const attached: LineShape = {
      ...arrow,
      startAnchor: { x: 1, y: 0.5, snap: "e" },
      endAnchor: { x: 0, y: 0.5, snap: "w" },
    }
    const board = mountBoard([source, target, attached])
    board.pointer("down", board.shapeElement(arrow.id), 0, 0)
    board.pointer("move", board.canvas, 0, 100)
    board.pointer("up", board.canvas, 0, 100)

    expect(board.connector().startBinding).toBeUndefined()
    expect(board.connector().endBinding).toBeUndefined()
    expect(board.connector().startAnchor).toBeUndefined()
    expect(board.connector().endAnchor).toBeUndefined()
    expect(board.connector()).toMatchObject({ x: -100, y: 100, dx: 200, dy: 0 })
  })

  it.each(["duplicate", "copy and paste"])(
    "%s preserves anchors only when the attached nodes are included",
    (operation) => {
      const attached: LineShape = {
        ...arrow,
        startAnchor: { x: 1, y: 0.25 },
        endAnchor: { x: 0, y: 0.5, snap: "w" },
      }
      const board = mountBoard([source, target, attached])
      function cloneSelection() {
        if (operation === "duplicate") {
          fireEvent.keyDown(window, { key: "d", ctrlKey: true })
        } else {
          fireEvent.keyDown(window, { key: "c", ctrlKey: true })
          fireEvent.keyDown(window, { key: "v", ctrlKey: true })
        }
      }

      board.select(arrow.id, 0, 0)
      cloneSelection()
      const detachedClone = store
        .getShapes()
        .find(
          (shape) => shape.type === "arrow" && shape.id !== arrow.id
        ) as LineShape
      expect(detachedClone).toBeDefined()
      expect(detachedClone.startBinding).toBeUndefined()
      expect(detachedClone.endBinding).toBeUndefined()
      expect(detachedClone.startAnchor).toBeUndefined()
      expect(detachedClone.endAnchor).toBeUndefined()

      fireEvent.keyDown(window, { key: "Delete" })
      fireEvent.keyDown(window, { key: "a", ctrlKey: true })
      cloneSelection()
      const boundClone = store
        .getShapes()
        .find(
          (shape) => shape.type === "arrow" && shape.id !== arrow.id
        ) as LineShape
      expect(boundClone.startBinding).not.toBe(source.id)
      expect(boundClone.endBinding).not.toBe(target.id)
      expect(store.getShape(boundClone.startBinding!)).toMatchObject({
        type: "rect",
        x: source.x + 16,
      })
      expect(store.getShape(boundClone.endBinding!)).toMatchObject({
        type: "rect",
        x: target.x + 16,
      })
      expect(boundClone.startAnchor).toEqual(attached.startAnchor)
      expect(boundClone.endAnchor).toEqual(attached.endAnchor)
      expect(boundClone).toMatchObject({ x: -84, y: -9, dx: 200, dy: 25 })
    }
  )
})
