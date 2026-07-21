import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { nanoid } from "nanoid"
import { useShapes } from "./store"
import { ShapeView } from "./ShapeView"
import { SelectionOverlay } from "./SelectionOverlay"
import { PeerCursors } from "./PeerCursors"
import { TextEditor } from "./TextEditor"
import { Toolbar } from "./Toolbar"
import { StylePanel } from "./StylePanel"
import { TopBar } from "./TopBar"
import { ZoomBar } from "./ZoomBar"
import { FONT_SIZES, isTextEditable } from "./types"
import {
  boxFromPoints,
  boxesIntersect,
  getCommonBounds,
  getShapeBounds,
  resizeBox,
  resizeShape,
  screenToWorld,
  snapAngle,
  translateShape,
} from "./geometry"
import type { BoardStore } from "./store"
import type { Box, HandleId, Point } from "./geometry"
import type { Camera, Shape, StyleDefaults, TextShape, ToolId } from "./types"

const STYLE_KEY = "kritzlboard:style"
const MIN_ZOOM = 0.1
const MAX_ZOOM = 8

function loadStyleDefaults(): StyleDefaults {
  try {
    const raw = localStorage.getItem(STYLE_KEY)
    if (raw)
      return { color: "black", fill: "none", size: "m", ...JSON.parse(raw) }
  } catch {
    // use defaults
  }
  return { color: "black", fill: "none", size: "m" }
}

type Session =
  | { kind: "pan"; startCamera: Camera; startScreen: Point }
  | {
      kind: "move"
      clickedId: string
      startWorld: Point
      original: Array<Shape>
      moved: boolean
    }
  | { kind: "resize"; handle: HandleId; from: Box; original: Array<Shape> }
  | { kind: "line-end"; id: string; which: "start" | "end"; original: Shape }
  | { kind: "brush"; startWorld: Point; baseSelection: ReadonlySet<string> }
  | { kind: "draw"; id: string; rawPoints: Array<Point> }
  | { kind: "box-new"; id: string; startWorld: Point }
  | { kind: "line-new"; id: string; startWorld: Point }
  | { kind: "erase" }

// simple module-level clipboard for copy/paste within the app
let clipboard: Array<Shape> = []

function findShapeIdFromEvent(target: EventTarget | null): string | null {
  if (!(target instanceof Element)) return null
  const el = target.closest("[data-shape-id]")
  return el?.getAttribute("data-shape-id") ?? null
}

export function Board({ store }: { store: BoardStore }) {
  const shapes = useShapes(store)
  const svgRef = useRef<SVGSVGElement>(null)
  const sessionRef = useRef<Session | null>(null)

  const [camera, setCamera] = useState<Camera>(() => ({
    x: -window.innerWidth / 2,
    y: -window.innerHeight / 2,
    z: 1,
  }))
  const cameraRef = useRef(camera)
  cameraRef.current = camera

  const [tool, setTool] = useState<ToolId>("select")
  const [selection, setSelection] = useState<ReadonlySet<string>>(
    () => new Set()
  )
  const [editingId, setEditingId] = useState<string | null>(null)
  const [style, setStyle] = useState<StyleDefaults>(loadStyleDefaults)
  const [spaceDown, setSpaceDown] = useState(false)
  const [brushBox, setBrushBox] = useState<Box | null>(null)
  const [eraseSet, setEraseSet] = useState<ReadonlySet<string>>(() => new Set())

  const selectedShapes = useMemo(
    () => shapes.filter((s) => selection.has(s.id)),
    [shapes, selection]
  )

  // publish selection to presence
  useEffect(() => {
    store.setSelectionPresence([...selection])
  }, [store, selection])

  // persist style defaults
  useEffect(() => {
    try {
      localStorage.setItem(STYLE_KEY, JSON.stringify(style))
    } catch {
      // ignore
    }
  }, [style])

  // drop selection entries for shapes deleted remotely
  useEffect(() => {
    if (selection.size === 0) return
    const live = [...selection].filter((id) => store.getShape(id))
    if (live.length !== selection.size) setSelection(new Set(live))
  }, [shapes, selection, store])

  // stop editing when the edited shape is deleted (e.g. by a peer)
  useEffect(() => {
    if (editingId != null && !store.getShape(editingId)) setEditingId(null)
  }, [shapes, editingId, store])

  const toWorld = useCallback((e: { clientX: number; clientY: number }) => {
    const rect = svgRef.current!.getBoundingClientRect()
    return screenToWorld(
      { x: e.clientX - rect.left, y: e.clientY - rect.top },
      cameraRef.current
    )
  }, [])

  const zoomAt = useCallback((screen: Point, nextZ: number) => {
    const z = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, nextZ))
    setCamera((cam) => {
      const world = { x: screen.x / cam.z + cam.x, y: screen.y / cam.z + cam.y }
      return { x: world.x - screen.x / z, y: world.y - screen.y / z, z }
    })
  }, [])

  const zoomStep = useCallback(
    (factor: number) => {
      const rect = svgRef.current?.getBoundingClientRect()
      const center = rect
        ? { x: rect.width / 2, y: rect.height / 2 }
        : { x: window.innerWidth / 2, y: window.innerHeight / 2 }
      zoomAt(center, cameraRef.current.z * factor)
    },
    [zoomAt]
  )

  const zoomToFit = useCallback(() => {
    const bounds = getCommonBounds(store.getShapes())
    const rect = svgRef.current?.getBoundingClientRect()
    if (!bounds || !rect) return
    const pad = 64
    const z = Math.min(
      MAX_ZOOM,
      Math.max(
        MIN_ZOOM,
        Math.min(
          rect.width / (bounds.w + pad * 2),
          rect.height / (bounds.h + pad * 2),
          1.5
        )
      )
    )
    setCamera({
      x: bounds.x + bounds.w / 2 - rect.width / 2 / z,
      y: bounds.y + bounds.h / 2 - rect.height / 2 / z,
      z,
    })
  }, [store])

  // --- clipboard-ish operations --------------------------------------------

  const deleteSelection = useCallback(() => {
    if (selection.size === 0) return
    store.deleteShapes(selection)
    setSelection(new Set())
  }, [store, selection])

  const duplicateShapes = useCallback(
    (source: Array<Shape>, offset = 16) => {
      if (source.length === 0) return
      let order = store.nextOrder()
      const clones = source.map((s) => ({
        ...translateShape(s, offset, offset),
        id: nanoid(12),
        order: order++,
      }))
      store.undoManager.stopCapturing()
      store.putShapes(clones)
      setSelection(new Set(clones.map((s) => s.id)))
      setTool("select")
    },
    [store]
  )

  // --- keyboard -------------------------------------------------------------

  useEffect(() => {
    const isEditableTarget = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      return (
        t &&
        (t.isContentEditable ||
          t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA")
      )
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (isEditableTarget(e)) return

      const mod = e.ctrlKey || e.metaKey
      if (mod) {
        switch (e.key.toLowerCase()) {
          case "z":
            e.preventDefault()
            if (e.shiftKey) store.redo()
            else store.undo()
            return
          case "y":
            e.preventDefault()
            store.redo()
            return
          case "a":
            e.preventDefault()
            setSelection(new Set(store.getShapes().map((s) => s.id)))
            setTool("select")
            return
          case "d":
            e.preventDefault()
            duplicateShapes(
              store.getShapes().filter((s) => selection.has(s.id))
            )
            return
          case "c":
            clipboard = store.getShapes().filter((s) => selection.has(s.id))
            return
          case "x":
            clipboard = store.getShapes().filter((s) => selection.has(s.id))
            deleteSelection()
            return
          case "v":
            duplicateShapes(clipboard)
            return
          case "=":
          case "+":
            e.preventDefault()
            zoomStep(1.25)
            return
          case "-":
            e.preventDefault()
            zoomStep(1 / 1.25)
            return
          case "0":
            e.preventDefault()
            zoomAt({ x: window.innerWidth / 2, y: window.innerHeight / 2 }, 1)
            return
        }
        return
      }

      switch (e.key) {
        case "Delete":
        case "Backspace":
          deleteSelection()
          return
        case "Escape":
          setSelection(new Set())
          setTool("select")
          return
        case "Enter":
          // edit the text / label of the only selected shape (like tldraw)
          if (selection.size === 1) {
            const shape = store.getShape([...selection][0])
            if (shape && isTextEditable(shape)) {
              e.preventDefault()
              store.undoManager.stopCapturing()
              setEditingId(shape.id)
            }
          }
          return
        case " ":
          if (!e.repeat) setSpaceDown(true)
          e.preventDefault()
          return
      }

      switch (e.key.toLowerCase()) {
        case "v":
          setTool("select")
          return
        case "h":
          setTool("hand")
          return
        case "p":
        case "d":
          setTool("draw")
          return
        case "r":
          setTool("rect")
          return
        case "o":
          setTool("ellipse")
          return
        case "l":
          setTool("line")
          return
        case "a":
          setTool("arrow")
          return
        case "t":
          setTool("text")
          return
        case "e":
          setTool("eraser")
          return
      }
    }

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === " ") setSpaceDown(false)
    }

    window.addEventListener("keydown", onKeyDown)
    window.addEventListener("keyup", onKeyUp)
    return () => {
      window.removeEventListener("keydown", onKeyDown)
      window.removeEventListener("keyup", onKeyUp)
    }
  }, [store, selection, deleteSelection, duplicateShapes, zoomStep, zoomAt])

  // --- wheel: pan / zoom -----------------------------------------------------

  useEffect(() => {
    const el = svgRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect = el.getBoundingClientRect()
      const screen = { x: e.clientX - rect.left, y: e.clientY - rect.top }
      const scale = e.deltaMode === 1 ? 16 : 1
      if (e.ctrlKey || e.metaKey) {
        const factor = Math.exp(-e.deltaY * scale * 0.0022)
        zoomAt(screen, cameraRef.current.z * factor)
      } else {
        const [dx, dy] =
          e.shiftKey && e.deltaX === 0
            ? [e.deltaY * scale, 0]
            : [e.deltaX * scale, e.deltaY * scale]
        setCamera((cam) => ({
          ...cam,
          x: cam.x + dx / cam.z,
          y: cam.y + dy / cam.z,
        }))
      }
    }
    el.addEventListener("wheel", onWheel, { passive: false })
    return () => el.removeEventListener("wheel", onWheel)
  }, [zoomAt])

  // --- shape creation helpers ------------------------------------------------

  const createTextShape = useCallback(
    (world: Point): TextShape => {
      const fontSize = FONT_SIZES[style.size]
      const shape: TextShape = {
        id: nanoid(12),
        type: "text",
        order: store.nextOrder(),
        color: style.color,
        size: style.size,
        x: world.x,
        y: world.y - fontSize * 0.7,
        w: 8,
        h: fontSize * 1.35,
        text: "",
        fontSize,
      }
      store.undoManager.stopCapturing()
      store.putShape(shape)
      return shape
    },
    [store, style]
  )

  const eraseHitTest = useCallback(
    (e: { clientX: number; clientY: number }) => {
      const ids = new Set<string>()
      for (const el of document.elementsFromPoint(e.clientX, e.clientY)) {
        const id = el.closest("[data-shape-id]")?.getAttribute("data-shape-id")
        if (id) ids.add(id)
      }
      return ids
    },
    []
  )

  // --- pointer handlers ------------------------------------------------------

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (sessionRef.current) return
    svgRef.current!.setPointerCapture(e.pointerId)
    const world = toWorld(e)

    // middle mouse, hand tool or space always pans
    if (e.button === 1 || tool === "hand" || spaceDown) {
      sessionRef.current = {
        kind: "pan",
        startCamera: cameraRef.current,
        startScreen: { x: e.clientX, y: e.clientY },
      }
      return
    }
    if (e.button !== 0) return

    if (editingId) {
      // clicking outside the editor commits it; typed text is already in the
      // store (committed on every input), but blur does not fire when the
      // editor unmounts, so discard still-empty text boxes here
      const editing = store.getShape(editingId)
      if (editing?.type === "text" && editing.text.trim() === "") {
        store.deleteShapes([editingId])
      }
      setEditingId(null)
      return
    }

    store.undoManager.stopCapturing()

    switch (tool) {
      case "select": {
        if (e.target instanceof Element) {
          const handleEl = e.target.closest("[data-resize-handle]")
          if (handleEl && selectedShapes.length > 0) {
            const from = getCommonBounds(selectedShapes)!
            sessionRef.current = {
              kind: "resize",
              handle: handleEl.getAttribute("data-resize-handle") as HandleId,
              from,
              original: selectedShapes,
            }
            return
          }
          const lineEndEl = e.target.closest("[data-line-handle]")
          if (lineEndEl && selectedShapes.length === 1) {
            sessionRef.current = {
              kind: "line-end",
              id: selectedShapes[0].id,
              which: lineEndEl.getAttribute("data-line-handle") as
                "start" | "end",
              original: selectedShapes[0],
            }
            return
          }
        }

        const hitId = findShapeIdFromEvent(e.target)
        if (hitId) {
          let nextSelection: Set<string>
          if (e.shiftKey) {
            nextSelection = new Set(selection)
            if (nextSelection.has(hitId)) {
              nextSelection.delete(hitId)
              setSelection(nextSelection)
              return
            }
            nextSelection.add(hitId)
          } else if (selection.has(hitId)) {
            nextSelection = new Set(selection)
          } else {
            nextSelection = new Set([hitId])
          }
          setSelection(nextSelection)
          sessionRef.current = {
            kind: "move",
            clickedId: hitId,
            startWorld: world,
            original: store.getShapes().filter((s) => nextSelection.has(s.id)),
            moved: false,
          }
          return
        }

        // empty canvas: rubber band
        sessionRef.current = {
          kind: "brush",
          startWorld: world,
          baseSelection: e.shiftKey ? selection : new Set(),
        }
        if (!e.shiftKey) setSelection(new Set())
        return
      }

      case "draw": {
        const shape: Shape = {
          id: nanoid(12),
          type: "draw",
          order: store.nextOrder(),
          color: style.color,
          size: style.size,
          x: world.x,
          y: world.y,
          w: 1,
          h: 1,
          points: [0, 0],
        }
        store.putShape(shape)
        sessionRef.current = { kind: "draw", id: shape.id, rawPoints: [world] }
        return
      }

      case "rect":
      case "ellipse": {
        const shape: Shape = {
          id: nanoid(12),
          type: tool,
          order: store.nextOrder(),
          color: style.color,
          size: style.size,
          fill: style.fill,
          x: world.x,
          y: world.y,
          w: 1,
          h: 1,
        }
        store.putShape(shape)
        sessionRef.current = {
          kind: "box-new",
          id: shape.id,
          startWorld: world,
        }
        return
      }

      case "line":
      case "arrow": {
        const shape: Shape = {
          id: nanoid(12),
          type: tool,
          order: store.nextOrder(),
          color: style.color,
          size: style.size,
          x: world.x,
          y: world.y,
          dx: 0,
          dy: 0,
        }
        store.putShape(shape)
        sessionRef.current = {
          kind: "line-new",
          id: shape.id,
          startWorld: world,
        }
        return
      }

      case "text": {
        // stop the browser's post-mousedown focus handling from stealing
        // focus back off the text editor we're about to mount
        e.preventDefault()
        const shape = createTextShape(world)
        setSelection(new Set([shape.id]))
        setEditingId(shape.id)
        setTool("select")
        return
      }

      case "eraser": {
        setEraseSet(eraseHitTest(e))
        sessionRef.current = { kind: "erase" }
        return
      }
    }
  }

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const world = toWorld(e)
    store.setCursor({ x: world.x, y: world.y })

    const session = sessionRef.current
    if (!session) return

    switch (session.kind) {
      case "pan": {
        const { startCamera, startScreen } = session
        setCamera({
          x: startCamera.x - (e.clientX - startScreen.x) / startCamera.z,
          y: startCamera.y - (e.clientY - startScreen.y) / startCamera.z,
          z: startCamera.z,
        })
        return
      }

      case "move": {
        let dx = world.x - session.startWorld.x
        let dy = world.y - session.startWorld.y
        if (!session.moved && Math.hypot(dx, dy) * cameraRef.current.z < 3) {
          return
        }
        session.moved = true
        if (e.shiftKey) {
          if (Math.abs(dx) > Math.abs(dy)) dy = 0
          else dx = 0
        }
        store.putShapes(session.original.map((s) => translateShape(s, dx, dy)))
        return
      }

      case "resize": {
        let to = resizeBox(session.from, session.handle, world)
        if (e.shiftKey && session.handle.length === 2) {
          // corner + shift: keep aspect ratio, anchored at the opposite corner
          const s = Math.max(to.w / session.from.w, to.h / session.from.h)
          const w = session.from.w * s
          const h = session.from.h * s
          const anchorX = session.handle.includes("w")
            ? session.from.x + session.from.w
            : session.from.x
          const anchorY = session.handle.includes("n")
            ? session.from.y + session.from.h
            : session.from.y
          to = {
            x: session.handle.includes("w") ? anchorX - w : anchorX,
            y: session.handle.includes("n") ? anchorY - h : anchorY,
            w,
            h,
          }
        }
        store.putShapes(
          session.original.map((s) => resizeShape(s, session.from, to))
        )
        return
      }

      case "line-end": {
        const orig = session.original
        if (orig.type !== "line" && orig.type !== "arrow") return
        if (session.which === "end") {
          let dx = world.x - orig.x
          let dy = world.y - orig.y
          if (e.shiftKey) ({ x: dx, y: dy } = snapAngle(dx, dy, Math.PI / 12))
          store.putShape({ ...orig, dx, dy })
        } else {
          const endX = orig.x + orig.dx
          const endY = orig.y + orig.dy
          let dx = endX - world.x
          let dy = endY - world.y
          if (e.shiftKey) ({ x: dx, y: dy } = snapAngle(dx, dy, Math.PI / 12))
          store.putShape({ ...orig, x: endX - dx, y: endY - dy, dx, dy })
        }
        return
      }

      case "brush": {
        const box = boxFromPoints(session.startWorld, world)
        setBrushBox(box)
        const next = new Set(session.baseSelection)
        for (const shape of store.getShapes()) {
          if (boxesIntersect(box, getShapeBounds(shape))) next.add(shape.id)
        }
        setSelection(next)
        return
      }

      case "draw": {
        const coalesced = e.nativeEvent.getCoalescedEvents()
        for (const ev of coalesced) {
          session.rawPoints.push(toWorld(ev))
        }
        const shape = store.getShape(session.id)
        if (!shape || shape.type !== "draw") return
        let minX = Infinity
        let minY = Infinity
        let maxX = -Infinity
        let maxY = -Infinity
        for (const p of session.rawPoints) {
          minX = Math.min(minX, p.x)
          minY = Math.min(minY, p.y)
          maxX = Math.max(maxX, p.x)
          maxY = Math.max(maxY, p.y)
        }
        const points: Array<number> = []
        for (const p of session.rawPoints) {
          points.push(p.x - minX, p.y - minY)
        }
        store.putShape({
          ...shape,
          x: minX,
          y: minY,
          w: Math.max(maxX - minX, 1),
          h: Math.max(maxY - minY, 1),
          points,
        })
        return
      }

      case "box-new": {
        const shape = store.getShape(session.id)
        if (!shape || (shape.type !== "rect" && shape.type !== "ellipse")) {
          return
        }
        let box = boxFromPoints(session.startWorld, world)
        if (e.shiftKey) {
          const side = Math.max(box.w, box.h)
          box = {
            x:
              world.x < session.startWorld.x
                ? session.startWorld.x - side
                : box.x,
            y:
              world.y < session.startWorld.y
                ? session.startWorld.y - side
                : box.y,
            w: side,
            h: side,
          }
        }
        store.putShape({ ...shape, ...box })
        return
      }

      case "line-new": {
        const shape = store.getShape(session.id)
        if (!shape || (shape.type !== "line" && shape.type !== "arrow")) return
        let dx = world.x - session.startWorld.x
        let dy = world.y - session.startWorld.y
        if (e.shiftKey) ({ x: dx, y: dy } = snapAngle(dx, dy, Math.PI / 4))
        store.putShape({ ...shape, dx, dy })
        return
      }

      case "erase": {
        const hits = eraseHitTest(e)
        if (hits.size === 0) return
        setEraseSet((prev) => {
          const next = new Set(prev)
          for (const id of hits) next.add(id)
          return next
        })
        return
      }
    }
  }

  const onPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    const session = sessionRef.current
    sessionRef.current = null
    if (svgRef.current?.hasPointerCapture(e.pointerId)) {
      svgRef.current.releasePointerCapture(e.pointerId)
    }
    if (!session) return

    switch (session.kind) {
      case "move": {
        if (!session.moved && !e.shiftKey && selection.size > 1) {
          setSelection(new Set([session.clickedId]))
        }
        return
      }
      case "brush": {
        setBrushBox(null)
        return
      }
      case "box-new": {
        const shape = store.getShape(session.id)
        if (shape && (shape.type === "rect" || shape.type === "ellipse")) {
          if (shape.w < 4 && shape.h < 4) {
            store.putShape({ ...shape, w: 160, h: 120 })
          }
          setSelection(new Set([session.id]))
        }
        setTool("select")
        return
      }
      case "line-new": {
        const shape = store.getShape(session.id)
        if (shape && (shape.type === "line" || shape.type === "arrow")) {
          if (Math.hypot(shape.dx, shape.dy) < 4) {
            store.putShape({ ...shape, dx: 120, dy: 0 })
          }
          setSelection(new Set([session.id]))
        }
        setTool("select")
        return
      }
      case "erase": {
        if (eraseSet.size > 0) store.deleteShapes(eraseSet)
        setEraseSet(new Set())
        return
      }
      default:
        return
    }
  }

  const onPointerLeave = () => {
    store.setCursor(null)
  }

  const onDoubleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (tool !== "select") return
    sessionRef.current = null
    // hit-test by point: pointer capture on the svg retargets the dblclick
    // event itself to the svg, so e.target never points at the shape
    let hitId: string | null = null
    for (const el of document.elementsFromPoint(e.clientX, e.clientY)) {
      const id = el.closest("[data-shape-id]")?.getAttribute("data-shape-id")
      if (id) {
        hitId = id
        break
      }
    }
    if (hitId) {
      const shape = store.getShape(hitId)
      // standalone text, or the label of a box/ellipse/line/arrow
      if (shape && isTextEditable(shape)) {
        store.undoManager.stopCapturing()
        setSelection(new Set([hitId]))
        setEditingId(shape.id)
      }
      return
    }
    const shape = createTextShape(toWorld(e))
    setSelection(new Set([shape.id]))
    setEditingId(shape.id)
  }

  // apply a style change to defaults and to the current selection
  const onStyleChange = (patch: Partial<StyleDefaults>) => {
    setStyle((prev) => ({ ...prev, ...patch }))
    if (selectedShapes.length === 0) return
    store.undoManager.stopCapturing()
    store.putShapes(
      selectedShapes.map((shape) => {
        let next: Shape = { ...shape }
        if (patch.color) next.color = patch.color
        if (patch.size) {
          next.size = patch.size
          if (next.type === "text") {
            const fontSize = FONT_SIZES[patch.size]
            const factor = fontSize / next.fontSize
            next = {
              ...next,
              fontSize,
              w: next.w * factor,
              h: next.h * factor,
            }
          }
        }
        if (patch.fill && (next.type === "rect" || next.type === "ellipse")) {
          next.fill = patch.fill
        }
        return next
      })
    )
  }

  const editingShape =
    editingId != null ? shapes.find((s) => s.id === editingId) : undefined

  const cursorClass =
    tool === "hand" || spaceDown
      ? "cursor-grab"
      : tool === "select"
        ? "cursor-default"
        : tool === "text"
          ? "cursor-text"
          : "cursor-crosshair"

  const gridSize = 24 * camera.z
  const showGrid = camera.z > 0.3

  return (
    <div className={`board-root bg-[#fafaf9] ${cursorClass}`}>
      {showGrid && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(circle, #d6d3d1 1px, transparent 1px)",
            backgroundSize: `${gridSize}px ${gridSize}px`,
            backgroundPosition: `${-camera.x * camera.z}px ${-camera.y * camera.z}px`,
          }}
        />
      )}

      <svg
        ref={svgRef}
        className="board-canvas relative"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={onPointerLeave}
        onDoubleClick={onDoubleClick}
      >
        <g
          transform={`scale(${camera.z}) translate(${-camera.x} ${-camera.y})`}
        >
          {shapes.map((shape) =>
            // a standalone text shape being edited is replaced by the HTML
            // editor; labeled shapes stay visible, only their label hides
            shape.id === editingId && shape.type === "text" ? null : (
              <ShapeView
                key={shape.id}
                shape={shape}
                fadeOut={eraseSet.has(shape.id)}
                hideLabel={shape.id === editingId}
              />
            )
          )}
          <SelectionOverlay
            store={store}
            shapes={shapes}
            selectedShapes={selectedShapes}
            camera={camera}
            brushBox={brushBox}
            hideHandles={editingId != null}
          />
        </g>
        <PeerCursors store={store} camera={camera} />
      </svg>

      {editingShape && isTextEditable(editingShape) && (
        <TextEditor
          key={editingShape.id}
          store={store}
          shape={editingShape}
          camera={camera}
          onDone={() => setEditingId(null)}
        />
      )}

      <TopBar store={store} />
      <Toolbar
        store={store}
        tool={tool}
        onToolChange={(t) => {
          setTool(t)
          if (t !== "select") setSelection(new Set())
        }}
      />
      <StylePanel
        tool={tool}
        selectedShapes={selectedShapes}
        style={style}
        onChange={onStyleChange}
      />
      <ZoomBar
        zoom={camera.z}
        onZoomIn={() => zoomStep(1.25)}
        onZoomOut={() => zoomStep(1 / 1.25)}
        onZoomReset={() =>
          zoomAt({ x: window.innerWidth / 2, y: window.innerHeight / 2 }, 1)
        }
        onZoomToFit={zoomToFit}
      />
    </div>
  )
}
