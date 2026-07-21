import { usePeers } from "./store"
import { worldToScreen } from "./geometry"
import type { BoardStore } from "./store"
import type { Camera } from "./types"

export function PeerCursors({
  store,
  camera,
}: {
  store: BoardStore
  camera: Camera
}) {
  const peers = usePeers(store)

  return (
    <g pointerEvents="none">
      {peers.map((peer) => {
        if (!peer.cursor) return null
        const p = worldToScreen(peer.cursor, camera)
        return (
          <g key={peer.clientId} transform={`translate(${p.x} ${p.y})`}>
            <path
              d="M 0 0 L 0 13.5 L 3.6 10.4 L 6 15.4 L 8.3 14.3 L 5.9 9.4 L 10.6 8.9 Z"
              fill={peer.user.color}
              stroke="white"
              strokeWidth={1}
            />
            <g transform="translate(12 16)">
              <rect
                x={0}
                y={0}
                width={peer.user.name.length * 6.6 + 12}
                height={20}
                rx={6}
                fill={peer.user.color}
              />
              <text
                x={6}
                y={14}
                fontSize={11}
                fontWeight={500}
                fill="white"
                style={{ userSelect: "none" }}
              >
                {peer.user.name}
              </text>
            </g>
          </g>
        )
      })}
    </g>
  )
}
