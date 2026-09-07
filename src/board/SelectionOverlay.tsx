import { usePeers } from "./store"
import {
  HANDLE_CURSORS,
  HANDLE_IDS,
  getCommonBounds,
  getHandlePosition,
  getShapeBounds,
} from "@kritzlboard/core"
import type { BoardStore } from "./store"
import type { Box, Camera, Shape } from "@kritzlboard/core"

const SELECT_COLOR = "#3667e8"

export function SelectionOverlay({
  store,
  shapes,
  selectedShapes,
  camera,
  brushBox,
  hideHandles,
}: {
  store: BoardStore
  shapes: Array<Shape>
  selectedShapes: Array<Shape>
  camera: Camera
  brushBox: Box | null
  hideHandles: boolean
}) {
  const peers = usePeers(store)
  const z = camera.z
  const thin = 1.5 / z
  const handleSize = 9 / z

  const bounds = getCommonBounds(selectedShapes)
  const singleLine =
    selectedShapes.length === 1 &&
    (selectedShapes[0].type === "line" || selectedShapes[0].type === "arrow")
      ? selectedShapes[0]
      : null

  return (
    <>
      {/* other users' selections */}
      {peers.map((peer) =>
        peer.selection.map((id) => {
          const shape = shapes.find((s) => s.id === id)
          if (!shape) return null
          const b = getShapeBounds(shape)
          return (
            <rect
              key={`${peer.clientId}-${id}`}
              x={b.x - 2 / z}
              y={b.y - 2 / z}
              width={b.w + 4 / z}
              height={b.h + 4 / z}
              fill="none"
              stroke={peer.user.color}
              strokeWidth={thin}
              opacity={0.7}
              pointerEvents="none"
            />
          )
        })
      )}

      {/* per-shape outlines */}
      {selectedShapes.length > 1 &&
        selectedShapes.map((shape) => {
          const b = getShapeBounds(shape)
          return (
            <rect
              key={shape.id}
              x={b.x}
              y={b.y}
              width={b.w}
              height={b.h}
              fill="none"
              stroke={SELECT_COLOR}
              strokeWidth={1 / z}
              opacity={0.5}
              pointerEvents="none"
            />
          )
        })}

      {/* selection bounds + resize handles */}
      {bounds && !singleLine && (
        <>
          <rect
            x={bounds.x}
            y={bounds.y}
            width={bounds.w}
            height={bounds.h}
            fill="none"
            stroke={SELECT_COLOR}
            strokeWidth={thin}
            pointerEvents="none"
          />
          {!hideHandles &&
            HANDLE_IDS.map((handle) => {
              const p = getHandlePosition(bounds, handle)
              return (
                <rect
                  key={handle}
                  data-resize-handle={handle}
                  x={p.x - handleSize / 2}
                  y={p.y - handleSize / 2}
                  width={handleSize}
                  height={handleSize}
                  rx={2 / z}
                  fill="white"
                  stroke={SELECT_COLOR}
                  strokeWidth={thin}
                  style={{ cursor: HANDLE_CURSORS[handle] }}
                />
              )
            })}
        </>
      )}

      {/* line endpoints stay available when a line is selected */}
      {singleLine &&
        !hideHandles &&
        (
          [
            ["start", singleLine.x, singleLine.y],
            ["end", singleLine.x + singleLine.dx, singleLine.y + singleLine.dy],
          ] as const
        ).map(([which, cx, cy]) => (
          <circle
            key={which}
            data-line-handle={which}
            cx={cx}
            cy={cy}
            r={handleSize / 1.6}
            fill="white"
            stroke={SELECT_COLOR}
            strokeWidth={thin}
            style={{ cursor: "move" }}
          />
        ))}

      {/* rubber band */}
      {brushBox && (
        <rect
          x={brushBox.x}
          y={brushBox.y}
          width={brushBox.w}
          height={brushBox.h}
          fill={SELECT_COLOR}
          fillOpacity={0.08}
          stroke={SELECT_COLOR}
          strokeWidth={1 / z}
          pointerEvents="none"
        />
      )}
    </>
  )
}
