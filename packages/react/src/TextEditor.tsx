import { FONT_STYLES } from "./typography.js"
import { useEffect, useRef } from "react"
import {
  worldToScreen,
  PALETTE,
  shapeFont,
  shapeFontSize,
} from "@kritzlboard/core"
import type { BoardStore, Camera, TextEditableShape } from "@kritzlboard/core"

/**
 * HTML overlay for editing text in place — either a standalone text shape or
 * the label of a rect/ellipse/line/arrow. Rendered outside the SVG and
 * positioned to match the camera.
 */
export function TextEditor({
  store,
  shape,
  camera,
  onDone,
}: {
  store: BoardStore
  shape: TextEditableShape
  camera: Camera
  onDone: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  // keep latest shape without re-running the mount effect
  const shapeRef = useRef(shape)
  shapeRef.current = shape

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.innerText = shapeRef.current.text ?? ""
    // defer focus one frame: when the editor mounts from a pointerdown, the
    // browser's default focus handling runs after the event and would
    // immediately blur (and thus delete) the empty editor
    const view = el.ownerDocument.defaultView!
    const raf = view.requestAnimationFrame(() => {
      el.focus()
      // place caret at the end
      const range = el.ownerDocument.createRange()
      range.selectNodeContents(el)
      range.collapse(false)
      const sel = el.ownerDocument.getSelection()
      sel?.removeAllRanges()
      sel?.addRange(range)
    })
    return () => view.cancelAnimationFrame(raf)
  }, [])

  // write the current text into the store; rect/ellipse labels also grow the
  // shape (around its center) when the text would overflow vertically
  const commit = () => {
    const el = ref.current
    if (!el) return
    const text = el.innerText.replace(/\n$/, "")
    const current = shapeRef.current
    if (current.type === "text") {
      const rect = el.getBoundingClientRect()
      store.putShape({
        ...current,
        text,
        w: Math.max(rect.width / camera.z, 8),
        h: Math.max(rect.height / camera.z, current.fontSize * 1.35),
      })
      return
    }
    if (current.type === "rect" || current.type === "ellipse") {
      const needed = el.getBoundingClientRect().height / camera.z
      if (needed > current.h) {
        const cy = current.y + current.h / 2
        store.putShape({ ...current, text, y: cy - needed / 2, h: needed })
        return
      }
    }
    store.putShape({ ...current, text })
  }

  const finish = () => {
    const el = ref.current
    const text = el ? el.innerText.trim() : ""
    // an empty standalone text shape is pointless; labels may stay empty
    if (shapeRef.current.type === "text" && text === "") {
      store.deleteShapes([shapeRef.current.id])
    } else {
      commit()
    }
    onDone()
  }

  const fontSize = shapeFontSize(shape)
  const color = PALETTE[shape.color].stroke
  const fontStyle = FONT_STYLES[shapeFont(shape)]

  const editorProps = {
    ref,
    contentEditable: "plaintext-only" as const,
    suppressContentEditableWarning: true,
    className: "kb-text",
    onInput: commit,
    onBlur: finish,
    onKeyDown: (e: React.KeyboardEvent) => {
      e.stopPropagation()
      if (e.key === "Escape") {
        e.preventDefault()
        finish()
      }
    },
    onPointerDown: (e: React.PointerEvent) => e.stopPropagation(),
  }

  if (shape.type === "text") {
    const screen = worldToScreen({ x: shape.x, y: shape.y }, camera)
    return (
      <div
        className="kb-absolute"
        style={{
          left: screen.x,
          top: screen.y,
          transform: `scale(${camera.z})`,
          transformOrigin: "top left",
        }}
      >
        <div
          {...editorProps}
          style={{
            fontSize,
            color,
            minWidth: 8,
            caretColor: color,
            ...fontStyle,
          }}
        />
      </div>
    )
  }

  if (shape.type === "rect" || shape.type === "ellipse") {
    // overlay the shape box, text centered; font pre-scaled to screen px
    const screen = worldToScreen({ x: shape.x, y: shape.y }, camera)
    return (
      <div
        className="kb-text-box-editor"
        style={{
          left: screen.x,
          top: screen.y,
          width: shape.w * camera.z,
          height: shape.h * camera.z,
        }}
      >
        <div
          {...editorProps}
          style={{
            fontSize: fontSize * camera.z,
            color,
            caretColor: color,
            width: "100%",
            padding: `0 ${8 * camera.z}px`,
            boxSizing: "border-box",
            textAlign: "center",
            ...fontStyle,
          }}
        />
      </div>
    )
  }

  // line / arrow: the label floats centered on the line's midpoint
  const mid = worldToScreen(
    { x: shape.x + shape.dx / 2, y: shape.y + shape.dy / 2 },
    camera
  )
  return (
    <div
      {...editorProps}
      className="kb-text kb-absolute"
      style={{
        left: mid.x,
        top: mid.y,
        transform: "translate(-50%, -50%)",
        fontSize: fontSize * camera.z,
        color,
        caretColor: color,
        width: "max-content",
        minWidth: 8,
        textAlign: "center",
        ...fontStyle,
      }}
    />
  )
}
