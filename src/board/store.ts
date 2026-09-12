import { BoardStore as CoreBoardStore } from "@kritzlboard/core"
import { BoardConnection } from "@kritzlboard/sync"
import { useSyncExternalStore } from "react"
import { getUser } from "@/lib/user"

function getSyncUrl(): string {
  const fromEnv = import.meta.env.VITE_SYNC_URL as string | undefined
  if (fromEnv) return fromEnv
  const proto = location.protocol === "https:" ? "wss:" : "ws:"
  return `${proto}//${location.host}/sync`
}

/** Application ownership: same-origin connection, current user, and document. */
export class BoardStore extends CoreBoardStore {
  readonly connection: BoardConnection

  constructor(boardId: string) {
    super(boardId)
    this.connection = new BoardConnection({
      store: this,
      url: getSyncUrl(),
      user: getUser(),
    })
  }

  override destroy() {
    this.connection.destroy()
    super.destroy()
  }
}

export function useConnectionStatus(store: BoardStore) {
  return useSyncExternalStore(
    store.connection.subscribe,
    store.connection.getStatus,
    store.connection.getStatus
  )
}

export { useBoardName, usePeers } from "@kritzlboard/react"
