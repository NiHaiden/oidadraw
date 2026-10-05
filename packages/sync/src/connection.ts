import { WebsocketProvider } from "y-websocket"
import { removeAwarenessStates } from "y-protocols/awareness"
import type { BoardStore, PeerState, UserInfo } from "@kritzlboard/core"

export type ConnectionStatus = "connecting" | "connected" | "offline"

export interface BoardConnectionOptions {
  store: BoardStore
  /** WebSocket base URL; the store's boardId is appended as the room name. */
  url: string
  user: UserInfo
  /** Provider tuning, including connect: false for an initially offline board. */
  providerOptions?: Omit<
    NonNullable<ConstructorParameters<typeof WebsocketProvider>[3]>,
    "awareness"
  >
}

/** Owns one transport and its presence. Never destroys the supplied core store. */
export class BoardConnection {
  readonly provider: WebsocketProvider
  private readonly store: BoardStore
  private peersSnapshot: Array<PeerState> = []
  private status: ConnectionStatus = "offline"
  private disposed = false
  private listeners = new Set<() => void>()

  constructor({ store, url, user, providerOptions }: BoardConnectionOptions) {
    if (store.doc.isDestroyed)
      throw new Error("Cannot connect a destroyed board store")
    this.store = store
    // Install identity and listeners before the first WebSocket or cross-tab sync.
    this.provider = new WebsocketProvider(url, store.boardId, store.doc, {
      maxBackoffTime: 5000,
      ...providerOptions,
      connect: false,
    })
    this.provider.awareness.setLocalState({ user, cursor: null, selection: [] })
    this.provider.awareness.on("change", this.onAwarenessChange)
    this.provider.on("status", this.onStatus)
    this.provider.on("connection-close", this.onConnectionClose)
    store.doc.on("destroy", this.destroy)
    if (providerOptions?.connect !== false) this.connect()
  }

  subscribe = (listener: () => void) => {
    if (!this.disposed) this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getPeers = () => this.peersSnapshot
  getStatus = () => this.status

  connect = () => {
    if (this.disposed || this.provider.wsconnected) return
    this.setStatus("connecting")
    this.provider.connect()
  }

  disconnect = () => {
    if (this.disposed) return
    const awareness = this.provider.awareness
    const localState = awareness.getLocalState()
    // Withdraw presence before detaching, so echoed updates cannot revive it.
    awareness.setLocalState(null)
    this.provider.disconnect()
    removeAwarenessStates(
      awareness,
      [...awareness.getStates().keys()].filter(
        (id) => id !== awareness.clientID
      ),
      this
    )
    awareness.setLocalState(localState)
    this.setStatus("offline")
  }

  setCursor = (cursor: PeerState["cursor"]) => {
    if (!this.disposed)
      this.provider.awareness.setLocalStateField("cursor", cursor)
  }

  setSelectionPresence = (selection: Array<string>) => {
    if (!this.disposed)
      this.provider.awareness.setLocalStateField("selection", selection)
  }

  setUser = (user: UserInfo) => {
    if (!this.disposed) this.provider.awareness.setLocalStateField("user", user)
  }

  destroy = () => {
    if (this.disposed) return
    this.disposed = true
    this.store.doc.off("destroy", this.destroy)
    this.provider.awareness.off("change", this.onAwarenessChange)
    this.provider.off("status", this.onStatus)
    this.provider.off("connection-close", this.onConnectionClose)
    this.provider.awareness.setLocalState(null)
    this.provider.destroy()
    // y-websocket leaves awareness alive; release its timer while the store lives on.
    this.provider.awareness.destroy()
    this.status = "offline"
    this.peersSnapshot = []
    this.emit()
    this.listeners.clear()
  }

  private emit() {
    for (const listener of this.listeners) listener()
  }

  private setStatus(status: ConnectionStatus) {
    if (status === this.status) return
    this.status = status
    this.emit()
  }

  private onStatus = ({
    status,
  }: {
    status: "connected" | "connecting" | "disconnected"
  }) => {
    this.setStatus(status === "disconnected" ? "offline" : status)
  }

  private onConnectionClose = () => this.setStatus("offline")

  private onAwarenessChange = ({
    added,
    updated,
    removed,
  }: {
    added: Array<number>
    updated: Array<number>
    removed: Array<number>
  }) => {
    const localId = this.provider.awareness.clientID
    if (![...added, ...updated, ...removed].some((id) => id !== localId)) return
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
    this.emit()
  }
}
