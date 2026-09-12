import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { nanoid } from "nanoid"
import { useShapes, usePeers } from "./hooks.js"
import {
  DEFAULT_FONT,
  DEFAULT_TEXT_SIZE,
  TEXT_FONT_SIZES,
  isTextEditable,
  bindTargetAt,
  boxFromPoints,
  boxesIntersect,
  getBindingAnchor,
  getBindingMargin,
  getCommonBounds,
  getShapeBounds,
  resizeBox,
  resizeShape,
  resolveBindingAnchor,
  screenToWorld,
  snapAngle,
  translateShape,
} from "@kritzlboard/core"
import { measureTextBox } from "./measureText.js"
import type { BoardOptions } from "./types.js"
import type {
  Box,
  HandleId,
  Point,
  BindingAnchor,
  BindingPointId,
  Camera,
  LineShape,
  Shape,
  StyleDefaults,
  TextShape,
  ToolId,
} from "@kritzlboard/core"

const MIN_ZOOM = 0.1
const MAX_ZOOM = 8

const DEFAULT_STYLE: StyleDefaults = {
  color: "black",
  fill: "none",
  strokeStyle: "solid",
  size: "m",
  font: DEFAULT_FONT,
  textSize: DEFAULT_TEXT_SIZE,
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
  | {
      kind: "line-new"
      id: string
      startWorld: Point
      start: {
        targetId: string
        anchor: BindingAnchor
        fromCenter: boolean
      } | null
    }
  | { kind: "erase" }

interface BindingPreview {
  targetId: string
  anchor: BindingAnchor
  point: Point
  snapPointId?: BindingPointId
}

function findShapeIdFromEvent(target: EventTarget | null): string | null {
  if (!(target instanceof Element)) return null
  const el = target.closest("[data-shape-id]")
  return el?.getAttribute("data-shape-id") ?? null
}

export function useBoardController({
  store,
  presence,
  initialStyle,
  onStyleChange: notifyStyleChange,
}: BoardOptions) {
  const rootRef = useRef<HTMLDivElement>(null)
  const clipboard = useRef<Array<Shape>>([])
  const previousSize = useRef({ width: 0, height: 0 })
  const peers = usePeers(presence)
  const shapes = useShapes(store)
  const svgRef = useRef<SVGSVGElement>(null)
  const sessionRef = useRef<Session | null>(null)

  const [camera, setCamera] = useState<Camera>(() => ({
    x: 0,
    y: 0,
    z: 1,
  }))
  const cameraRef = useRef(camera)
  cameraRef.current = camera

  const [tool, setTool] = useState<ToolId>("select")
  const [selection, setSelection] = useState<ReadonlySet<string>>(
    () => new Set()
  )
  const [editingId, setEditingId] = useState<string | null>(null)
  const [style, setStyle] = useState<StyleDefaults>(() => ({
    ...DEFAULT_STYLE,
    ...initialStyle,
  }))
  const [spaceDown, setSpaceDown] = useState(false)
  const [brushBox, setBrushBox] = useState<Box | null>(null)
  const [eraseSet, setEraseSet] = useState<ReadonlySet<string>>(() => new Set())
  const [bindingPreview, setBindingPreview] = useState<BindingPreview | null>(
    null
  )

  const selectedShapes = useMemo(
    () => shapes.filter((s) => selection.has(s.id)),
    [shapes, selection]
  )

  // publish selection to presence
  useEffect(() => {
    presence?.setSelectionPresence([...selection])
  }, [presence, selection])

  useEffect(() => {
    notifyStyleChange?.(style)
  }, [style, notifyStyleChange])

  useEffect(
    () => () => {
      presence?.setCursor(null)
      presence?.setSelectionPresence([])
    },
    [presence]
  )

  // Keep the visible world center steady when the host container changes size.
  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const measure = () => {
      const { width, height } = root.getBoundingClientRect()
      if (width <= 0 || height <= 0) return
      const dx = width - previousSize.current.width
      const dy = height - previousSize.current.height
      previousSize.current = { width, height }
      setCamera((cam) => ({
        ...cam,
        x: cam.x - dx / (2 * cam.z),
        y: cam.y - dy / (2 * cam.z),
      }))
    }
    measure()
    const Observer = root.ownerDocument.defaultView?.ResizeObserver
    const observer = Observer ? new Observer(measure) : undefined
    observer?.observe(root)
    return () => observer?.disconnect()
  }, [])

  useEffect(() => {
    const view = rootRef.current?.ownerDocument.defaultView
    const reset = () => setSpaceDown(false)
    view?.addEventListener("blur", reset)
    return () => view?.removeEventListener("blur", reset)
  }, [])

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

  const findBinding = (
    point: Point,
    excludeId?: string,
    toward?: Point
  ): BindingPreview | null => {
    const target = bindTargetAt(
      point,
      store.getShapes(),
      getBindingMargin(cameraRef.current.z),
      excludeId
    )
    return target
      ? {
          targetId: target.id,
          ...getBindingAnchor(target, point, cameraRef.current.z, toward),
        }
      : null
  }

  const findEndpointBinding = (
    line: LineShape,
    which: "start" | "end",
    point: Point
  ) => {
    const start = { x: line.x, y: line.y }
    const end = { x: line.x + line.dx, y: line.y + line.dy }
    const toward = which === "end" ? start : end
    const other = which === "end" ? line.startBinding : line.endBinding
    const binding = findBinding(point, other, toward)
    if (binding) return binding

    // Older endpoints sit six world units outside the outline. Let their
    // visible handles be picked up without expanding every node's snap zone.
    const endpoint = which === "end" ? end : start
    if (
      Math.hypot(point.x - endpoint.x, point.y - endpoint.y) >
      12 / cameraRef.current.z
    )
      return null
    const targetId = which === "end" ? line.endBinding : line.startBinding
    const target =
      targetId && targetId !== other ? store.getShape(targetId) : undefined
    return target
      ? {
          targetId: target.id,
          ...getBindingAnchor(target, point, cameraRef.current.z, toward),
        }
      : null
  }

  useEffect(() => {
    setBindingPreview(null)
  }, [tool])

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
        : { x: 0, y: 0 }
      zoomAt(center, cameraRef.current.z * factor)
    },
    [zoomAt]
  )

  const resetZoom = useCallback(() => {
    const rect = svgRef.current?.getBoundingClientRect()
    if (rect) zoomAt({ x: rect.width / 2, y: rect.height / 2 }, 1)
  }, [zoomAt])

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
      const idMap = new Map(source.map((s) => [s.id, nanoid(12)]))
      const clones = source.map((s) => {
        const clone = {
          ...translateShape(s, offset, offset),
          id: idMap.get(s.id)!,
          order: order++,
        }
        if (clone.type === "line" || clone.type === "arrow") {
          // bindings follow only if the target was copied too
          for (const key of ["startBinding", "endBinding"] as const) {
            const bound = clone[key]
            if (!bound) continue
            const mapped = idMap.get(bound)
            if (mapped) clone[key] = mapped
            else {
              delete clone[key]
              delete clone[key === "startBinding" ? "startAnchor" : "endAnchor"]
            }
          }
        }
        return clone
      })
      store.stopCapturing()
      store.putShapes(clones)
      setSelection(new Set(clones.map((s) => s.id)))
      setTool("select")
    },
    [store]
  )

  // --- keyboard -------------------------------------------------------------

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const isEditableTarget = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      return (
        t &&
        (t.isContentEditable ||
          t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.tagName === "SELECT" ||
          !!t.closest(
            '[contenteditable="true"], [contenteditable="plaintext-only"]'
          ))
      )
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || isEditableTarget(e)) return
      const target = e.target as HTMLElement | null
      if (target?.closest("[data-kritzlboard-root]") !== root) return
      if ((e.key === " " || e.key === "Enter") && target.closest("button, a"))
        return

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
            clipboard.current = store
              .getShapes()
              .filter((s) => selection.has(s.id))
            return
          case "x":
            clipboard.current = store
              .getShapes()
              .filter((s) => selection.has(s.id))
            deleteSelection()
            return
          case "v":
            duplicateShapes(clipboard.current)
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
            resetZoom()
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
              store.stopCapturing()
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

    root.addEventListener("keydown", onKeyDown)
    root.addEventListener("keyup", onKeyUp)
    return () => {
      root.removeEventListener("keydown", onKeyDown)
      root.removeEventListener("keyup", onKeyUp)
    }
  }, [store, selection, deleteSelection, duplicateShapes, zoomStep, resetZoom])

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
      const fontSize = TEXT_FONT_SIZES[style.textSize]
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
        font: style.font,
      }
      store.stopCapturing()
      store.putShape(shape)
      return shape
    },
    [store, style]
  )

  const eraseHitTest = useCallback(
    (e: { clientX: number; clientY: number }) => {
      const ids = new Set<string>()
      for (const el of svgRef.current!.ownerDocument.elementsFromPoint(
        e.clientX,
        e.clientY
      )) {
        const id = el.closest("[data-shape-id]")?.getAttribute("data-shape-id")
        if (id && svgRef.current?.contains(el)) ids.add(id)
      }
      return ids
    },
    []
  )

  // --- pointer handlers ------------------------------------------------------

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (sessionRef.current) return
    rootRef.current?.focus({ preventScroll: true })
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

    store.stopCapturing()

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
            const original = selectedShapes[0]
            const which = lineEndEl.getAttribute("data-line-handle") as
              "start" | "end"
            if (original.type !== "line" && original.type !== "arrow") return
            sessionRef.current = {
              kind: "line-end",
              id: original.id,
              which,
              original,
            }
            setBindingPreview(findEndpointBinding(original, which, world))
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
        if (!e.shiftKey) {
          setSelection(new Set())
        }
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
          font: style.font,
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
        const start = findBinding(world)
        const shape: Shape = {
          id: nanoid(12),
          type: tool,
          order: store.nextOrder(),
          color: style.color,
          size: style.size,
          font: style.font,
          x: world.x,
          y: world.y,
          dx: 0,
          dy: 0,
          ...(start
            ? { startBinding: start.targetId, startAnchor: start.anchor }
            : {}),
        }
        setBindingPreview(start)
        store.putShape(shape)
        const startBounds = start
          ? getShapeBounds(store.getShape(start.targetId)!)
          : undefined
        sessionRef.current = {
          kind: "line-new",
          id: shape.id,
          startWorld: world,
          start:
            start && startBounds
              ? {
                  targetId: start.targetId,
                  anchor: start.anchor,
                  fromCenter:
                    Math.hypot(
                      world.x - startBounds.x - startBounds.w / 2,
                      world.y - startBounds.y - startBounds.h / 2
                    ) < 1e-9,
                }
              : null,
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
    presence?.setCursor({ x: world.x, y: world.y })

    const session = sessionRef.current
    if (!session) {
      setBindingPreview(
        (tool === "arrow" || tool === "line") && !spaceDown && !editingId
          ? findBinding(world)
          : null
      )
      return
    }

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
        const movedIds = new Set(session.original.map((s) => s.id))
        const moved = session.original.map((s) => {
          const m = translateShape(s, dx, dy)
          // dragging a latched line away from a stationary target detaches it
          if (m.type === "line" || m.type === "arrow") {
            if (m.startBinding && !movedIds.has(m.startBinding)) {
              delete m.startBinding
              delete m.startAnchor
            }
            if (m.endBinding && !movedIds.has(m.endBinding)) {
              delete m.endBinding
              delete m.endAnchor
            }
          }
          return m
        })
        store.putShapes(moved)
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
        const next = { ...orig }
        if (session.which === "end") {
          let dx = world.x - orig.x
          let dy = world.y - orig.y
          if (e.shiftKey) ({ x: dx, y: dy } = snapAngle(dx, dy, Math.PI / 12))
          next.dx = dx
          next.dy = dy
        } else {
          const endX = orig.x + orig.dx
          const endY = orig.y + orig.dy
          let dx = endX - world.x
          let dy = endY - world.y
          if (e.shiftKey) ({ x: dx, y: dy } = snapAngle(dx, dy, Math.PI / 12))
          next.x = endX - dx
          next.y = endY - dy
          next.dx = dx
          next.dy = dy
        }
        // latch the dragged end; never both ends onto the same shape
        const binding = findEndpointBinding(orig, session.which, world)
        const key = session.which === "end" ? "endBinding" : "startBinding"
        const anchorKey = session.which === "end" ? "endAnchor" : "startAnchor"
        delete next[key]
        delete next[anchorKey]
        if (binding) {
          next[key] = binding.targetId
          next[anchorKey] = binding.anchor
        }
        setBindingPreview(binding)
        store.putShape(next)
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
        const native: Partial<PointerEvent> = e.nativeEvent
        const coalesced = native.getCoalescedEvents?.() ?? [e.nativeEvent]
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
        // Keep the point chosen at pointerdown. A center-start gesture uses
        // the drag direction to choose an edge until the connector is placed.
        const startTarget = session.start
          ? store.getShape(session.start.targetId)
          : undefined
        let start: { anchor: BindingAnchor; point: Point } | undefined
        if (startTarget && session.start) {
          if (session.start.fromCenter) {
            const bounds = getShapeBounds(startTarget)
            start = getBindingAnchor(
              startTarget,
              { x: bounds.x + bounds.w / 2, y: bounds.y + bounds.h / 2 },
              cameraRef.current.z,
              world
            )
          } else {
            start = {
              anchor: session.start.anchor,
              point: resolveBindingAnchor(startTarget, session.start.anchor),
            }
          }
        }
        const end = findBinding(
          world,
          shape.startBinding,
          start?.point ?? session.startWorld
        )
        const next = {
          ...shape,
          x: session.startWorld.x,
          y: session.startWorld.y,
          dx,
          dy,
        }
        if (start) next.startAnchor = start.anchor
        delete next.endBinding
        delete next.endAnchor
        if (end) {
          next.endBinding = end.targetId
          next.endAnchor = end.anchor
        }
        setBindingPreview(end)
        store.putShape(next)
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
    // A release can arrive at a newer position than the last pointermove.
    if (
      e.type === "pointerup" &&
      (session?.kind === "line-new" || session?.kind === "line-end")
    ) {
      onPointerMove(e)
    }
    sessionRef.current = null
    setBindingPreview(null)
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
          const world = toWorld(e)
          const dragged =
            Math.hypot(
              world.x - session.startWorld.x,
              world.y - session.startWorld.y
            ) * cameraRef.current.z
          if (dragged < 4 && !shape.endBinding) {
            const next = {
              ...shape,
              x: session.startWorld.x,
              y: session.startWorld.y,
              dx: 120,
              dy: 0,
            }
            const target = session.start
              ? store.getShape(session.start.targetId)
              : undefined
            if (target && session.start) {
              const bounds = getShapeBounds(target)
              const center = {
                x: bounds.x + bounds.w / 2,
                y: bounds.y + bounds.h / 2,
              }
              const anchor = session.start.fromCenter
                ? getBindingAnchor(target, center, cameraRef.current.z, {
                    x: center.x + 120,
                    y: center.y,
                  }).anchor
                : session.start.anchor
              const point = resolveBindingAnchor(target, anchor)
              const dx = point.x - center.x
              const dy = point.y - center.y
              const length = Math.hypot(dx, dy)
              next.startAnchor = anchor
              next.x = point.x
              next.y = point.y
              next.dx = length > 0 ? (dx / length) * 120 : 120
              next.dy = length > 0 ? (dy / length) * 120 : 0
            }
            delete next.endBinding
            delete next.endAnchor
            store.putShape(next)
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
    presence?.setCursor(null)
    if (!sessionRef.current) setBindingPreview(null)
  }

  const onDoubleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (tool !== "select") return
    sessionRef.current = null
    // hit-test by point: pointer capture on the svg retargets the dblclick
    // event itself to the svg, so e.target never points at the shape
    let hitId: string | null = null
    for (const el of svgRef.current!.ownerDocument.elementsFromPoint(
      e.clientX,
      e.clientY
    )) {
      const id = el.closest("[data-shape-id]")?.getAttribute("data-shape-id")
      if (id && svgRef.current?.contains(el)) {
        hitId = id
        break
      }
    }
    if (hitId) {
      const shape = store.getShape(hitId)
      // standalone text, or the label of a box/ellipse/line/arrow
      if (shape && isTextEditable(shape)) {
        store.stopCapturing()
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
    store.stopCapturing()
    store.putShapes(
      selectedShapes.map((shape) => {
        let next: Shape = { ...shape }
        if (patch.color) next.color = patch.color
        if (patch.size) next.size = patch.size
        if (patch.fill && (next.type === "rect" || next.type === "ellipse")) {
          next.fill = patch.fill
        }
        // text size is its own knob: a box's stroke width and its text size
        // are chosen independently
        if (patch.textSize) {
          const fontSize = TEXT_FONT_SIZES[patch.textSize]
          if (next.type === "text") {
            const factor = fontSize / next.fontSize
            next = {
              ...next,
              fontSize,
              w: next.w * factor,
              h: next.h * factor,
            }
          } else if (next.type !== "draw") {
            next = { ...next, textSize: patch.textSize }
          }
        }
        if (patch.font && isTextEditable(next)) {
          next = { ...next, font: patch.font }
          // the stored box drives wrapping, and the two fonts differ enough in
          // metrics that keeping it would reflow the text
          if (next.type === "text") {
            next = {
              ...next,
              ...measureTextBox(
                rootRef.current!,
                next.text,
                next.fontSize,
                patch.font
              ),
            }
          }
        }
        if (
          patch.strokeStyle &&
          (next.type === "rect" ||
            next.type === "ellipse" ||
            next.type === "line" ||
            next.type === "arrow")
        ) {
          next = { ...next, strokeStyle: patch.strokeStyle }
        }
        return next
      })
    )
  }

  const changeTool = (next: ToolId) => {
    setTool(next)
    if (next !== "select") setSelection(new Set())
  }

  return {
    rootRef,
    svgRef,
    shapes,
    peers,
    brushBox,
    eraseSet,
    bindingPreview,
    editingId,
    setEditingId,
    spaceDown,
    clearSpace: () => setSpaceDown(false),
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerLeave,
    onDoubleClick,
    editor: {
      store,
      camera,
      tool,
      selection,
      selectedShapes,
      style,
      setTool: changeTool,
      setSelection,
      changeStyle: onStyleChange,
      deleteSelection,
      duplicateSelection: () => duplicateShapes(selectedShapes),
      selectAll: () => {
        setSelection(new Set(store.getShapes().map((shape) => shape.id)))
        setTool("select")
      },
      zoomIn: () => zoomStep(1.25),
      zoomOut: () => zoomStep(1 / 1.25),
      resetZoom,
      zoomToFit,
    },
  }
}
