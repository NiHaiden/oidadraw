import type { PeerState } from "@kritzlboard/core"
import type { BoardPresence } from "@kritzlboard/react"

/** Demo-only adapter: no networking, persistence, timers, or global state. */
export function createPresencePair(): [BoardPresence, BoardPresence] {
  const states: [PeerState, PeerState] = [
    { clientId: 1, user: { name: "Alex", color: "#3667e8" }, cursor: null, selection: [] },
    { clientId: 2, user: { name: "Sam", color: "#7048c6" }, cursor: null, selection: [] },
  ]
  const snapshots: [Array<PeerState>, Array<PeerState>] = [[states[1]], [states[0]]]
  const listeners = [new Set<() => void>(), new Set<() => void>()]

  function endpoint(index: 0 | 1): BoardPresence {
    const other = index === 0 ? 1 : 0
    const publish = (patch: Partial<Pick<PeerState, "cursor" | "selection">>) => {
      states[index] = { ...states[index], ...patch }
      snapshots[other] = [states[index]]
      for (const listener of listeners[other]) listener()
    }
    return {
      subscribe: (listener) => {
        listeners[index].add(listener)
        return () => { listeners[index].delete(listener) }
      },
      getPeers: () => snapshots[index],
      setCursor: (cursor) => publish({ cursor: cursor ? { ...cursor } : null }),
      setSelectionPresence: (selection) => publish({ selection: [...selection] }),
    }
  }
  return [endpoint(0), endpoint(1)]
}
