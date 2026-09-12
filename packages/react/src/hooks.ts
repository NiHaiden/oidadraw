import { useEffect, useState, useSyncExternalStore } from "react"
import { BoardStore } from "@kritzlboard/core"
import type { PeerState } from "@kritzlboard/core"
import type { BoardPresence } from "./types.js"

const emptyPeers: Array<PeerState> = []
const getEmptyPeers = () => emptyPeers
const subscribeToNothing = () => () => {}

/** Creates a local store after mount and disposes it on unmount or ID changes. */
export function useBoardStore(boardId = "local"): BoardStore | null {
  const [store, setStore] = useState<BoardStore | null>(null)
  useEffect(() => {
    const next = new BoardStore(boardId)
    setStore(next)
    return () => next.destroy()
  }, [boardId])
  return store?.boardId === boardId ? store : null
}

export function useShapes(store: BoardStore) {
  return useSyncExternalStore(store.subscribe, store.getShapes, store.getShapes)
}

export function usePeers(presence?: BoardPresence) {
  return useSyncExternalStore(
    presence?.subscribe ?? subscribeToNothing,
    presence?.getPeers ?? getEmptyPeers,
    getEmptyPeers
  )
}

export function useBoardName(store: BoardStore) {
  return useSyncExternalStore(
    store.subscribe,
    store.getBoardName,
    store.getBoardName
  )
}

export function useCanUndoRedo(store: BoardStore) {
  const canUndo = useSyncExternalStore(
    store.subscribe,
    store.getCanUndo,
    store.getCanUndo
  )
  const canRedo = useSyncExternalStore(
    store.subscribe,
    store.getCanRedo,
    store.getCanRedo
  )
  return { canUndo, canRedo }
}
