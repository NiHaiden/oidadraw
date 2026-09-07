import { BoardStore as CoreBoardStore } from "@kritzlboard/core"
import { WebsocketProvider } from "y-websocket"
import { useSyncExternalStore } from "react"
import { getUser } from "@/lib/user"
import type { PeerState, Shape, UserInfo } from "@kritzlboard/core"

function getSyncUrl(): string {
  const fromEnv = import.meta.env.VITE_SYNC_URL as string | undefined
  if (fromEnv) return fromEnv
  const proto = location.protocol === "https:" ? "wss:" : "ws:"
  return `${proto}//${location.host}/sync`
}

export type ConnectionStatus = "connecting" | "connected" | "offline"

/** Application adapter: same-origin sync and the current user's presence. */
export class BoardStore extends CoreBoardStore {
  readonly provider: WebsocketProvider
  private peersSnapshot: Array<PeerState> = []
  private status: ConnectionStatus = "connecting"
  private disposed = false

  constructor(boardId: string) {
    super(boardId)
    this.provider = new WebsocketProvider(getSyncUrl(), boardId, this.doc, {
      maxBackoffTime: 5000,
    })
    this.provider.awareness.setLocalState({
      user: getUser(),
      cursor: null,
      selection: [],
    })
    this.provider.awareness.on("change", () => {
      this.rebuildPeers()
      this.emit()
    })
    this.provider.on("status", ({ status }: { status: string }) => {
      this.status = status === "connected" ? "connected" : "connecting"
      this.emit()
    })
    this.provider.on("connection-close", () => {
      this.status = "offline"
      this.emit()
    })
  }

  override destroy() {
    if (this.disposed) return
    this.disposed = true
    this.provider.destroy()
    super.destroy()
  }

  private rebuildPeers() {
    const localId = this.provider.awareness.clientID
    const peers: Array<PeerState> = []
    for (const [clientId, state] of this.provider.awareness.getStates()) {
      if (clientId === localId) continue
      const user = state.user as UserInfo | undefined
      if (!user) continue
      peers.push({
        clientId,
        user,
        cursor: (state.cursor as PeerState["cursor"]) ?? null,
        selection: (state.selection as Array<string> | undefined) ?? [],
      })
    }
    peers.sort((a, b) => a.clientId - b.clientId)
    this.peersSnapshot = peers
  }

  getPeers = () => this.peersSnapshot
  getStatus = () => this.status

  // --- presence ------------------------------------------------------------

  setCursor(cursor: { x: number; y: number } | null) {
    this.provider.awareness.setLocalStateField("cursor", cursor)
  }

  setSelectionPresence(selection: Array<string>) {
    this.provider.awareness.setLocalStateField("selection", selection)
  }

  setUser(user: UserInfo) {
    this.provider.awareness.setLocalStateField("user", user)
  }
}

// --- hooks -----------------------------------------------------------------

export function useShapes(store: BoardStore): Array<Shape> {
  return useSyncExternalStore(store.subscribe, store.getShapes)
}

export function usePeers(store: BoardStore): Array<PeerState> {
  return useSyncExternalStore(store.subscribe, store.getPeers)
}

export function useConnectionStatus(store: BoardStore): ConnectionStatus {
  return useSyncExternalStore(store.subscribe, store.getStatus)
}

export function useBoardName(store: BoardStore): string {
  return useSyncExternalStore(store.subscribe, store.getBoardName)
}

export function useCanUndoRedo(store: BoardStore): {
  canUndo: boolean
  canRedo: boolean
} {
  const canUndo = useSyncExternalStore(store.subscribe, store.getCanUndo)
  const canRedo = useSyncExternalStore(store.subscribe, store.getCanRedo)
  return { canUndo, canRedo }
}
