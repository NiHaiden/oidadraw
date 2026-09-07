import * as Y from "yjs"
import { WebsocketProvider } from "y-websocket"
import { useSyncExternalStore } from "react"
import { getUser } from "@/lib/user"
import { layoutBoundLine, updateBoundLines } from "./geometry"
import type { PeerState, Shape, UserInfo } from "./types"

function getSyncUrl(): string {
  const fromEnv = import.meta.env.VITE_SYNC_URL as string | undefined
  if (fromEnv) return fromEnv
  const proto = location.protocol === "https:" ? "wss:" : "ws:"
  return `${proto}//${location.host}/sync`
}

export type ConnectionStatus = "connecting" | "connected" | "offline"

/**
 * Shared state for one board: a Yjs document synced over websocket, plus
 * cached snapshots so React can subscribe via useSyncExternalStore.
 */
export class BoardStore {
  readonly boardId: string
  readonly doc = new Y.Doc()
  readonly yShapes: Y.Map<Shape>
  readonly yMeta: Y.Map<string>
  readonly provider: WebsocketProvider
  readonly undoManager: Y.UndoManager
  /** Origin token marking local transactions (tracked by undo). */
  readonly origin = Symbol("local")

  private shapesSnapshot: Array<Shape> = []
  private shapesById: Map<string, Shape> = new Map()
  private peersSnapshot: Array<PeerState> = []
  private status: ConnectionStatus = "connecting"
  private listeners = new Set<() => void>()

  constructor(boardId: string) {
    this.boardId = boardId
    this.yShapes = this.doc.getMap<Shape>("shapes")
    this.yMeta = this.doc.getMap<string>("meta")

    this.provider = new WebsocketProvider(getSyncUrl(), boardId, this.doc, {
      maxBackoffTime: 5000,
    })
    this.undoManager = new Y.UndoManager(this.yShapes, {
      trackedOrigins: new Set([this.origin]),
    })

    const user = getUser()
    this.provider.awareness.setLocalState({
      user,
      cursor: null,
      selection: [],
    })

    this.yShapes.observe(() => {
      this.rebuildShapes()
      this.emit()
    })
    this.yMeta.observe(() => this.emit())
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
    this.undoManager.on("stack-item-added", () => this.emit())
    this.undoManager.on("stack-item-popped", () => this.emit())
    this.undoManager.on("stack-cleared", () => this.emit())
  }

  destroy() {
    this.provider.destroy()
    this.undoManager.destroy()
    this.doc.destroy()
  }

  // --- subscriptions -------------------------------------------------------

  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private emit() {
    for (const l of this.listeners) l()
  }

  private rebuildShapes() {
    const shapes = [...this.yShapes.values()]
    shapes.sort((a, b) => a.order - b.order || (a.id < b.id ? -1 : 1))
    const byId = new Map(shapes.map((s) => [s.id, s]))
    // Remote edits can merge a node's new position with an older connector.
    // Derive the visible endpoints from the merged document without creating
    // another shared write or an undo entry for a remote change.
    this.shapesSnapshot = shapes.map((shape) =>
      shape.type === "line" || shape.type === "arrow"
        ? layoutBoundLine(shape, (id) => byId.get(id))
        : shape
    )
    this.shapesById = new Map(this.shapesSnapshot.map((s) => [s.id, s]))
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

  getShapes = () => this.shapesSnapshot
  getShape(id: string): Shape | undefined {
    return this.shapesById.get(id)
  }
  getPeers = () => this.peersSnapshot
  getStatus = () => this.status
  getBoardName = () => this.yMeta.get("name") ?? ""
  getCanUndo = () => this.undoManager.canUndo()
  getCanRedo = () => this.undoManager.canRedo()

  // --- mutations -----------------------------------------------------------

  transact(fn: () => void) {
    this.doc.transact(fn, this.origin)
  }

  putShape(shape: Shape) {
    this.putShapes([shape])
  }

  putShapes(shapes: Array<Shape>) {
    const all = new Map(this.yShapes)
    for (const shape of shapes) all.set(shape.id, shape)
    const updated = updateBoundLines(shapes, [...all.values()])
    this.transact(() => {
      // Keep node changes and attached connectors in the same undo step.
      for (const shape of updated) this.yShapes.set(shape.id, shape)
    })
  }

  deleteShapes(ids: Iterable<string>) {
    const deleted = new Set(ids)
    this.transact(() => {
      // A remote node edit can leave stored endpoints behind the displayed
      // ones. Freeze the current geometry before a target disappears, while
      // retaining its binding ID so undo can restore the attachment.
      for (const shape of this.shapesSnapshot) {
        if (deleted.has(shape.id)) continue
        if (shape.type !== "line" && shape.type !== "arrow") continue
        if (
          (shape.startBinding && deleted.has(shape.startBinding)) ||
          (shape.endBinding && deleted.has(shape.endBinding))
        ) {
          this.yShapes.set(shape.id, shape)
        }
      }
      for (const id of deleted) this.yShapes.delete(id)
    })
  }

  nextOrder(): number {
    let max = 0
    for (const shape of this.shapesSnapshot) max = Math.max(max, shape.order)
    return max + 1
  }

  setBoardName(name: string) {
    this.doc.transact(() => this.yMeta.set("name", name))
  }

  undo() {
    this.undoManager.undo()
  }

  redo() {
    this.undoManager.redo()
  }

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
