import { useState } from "react"
import { Board, usePeers } from "@kritzlboard/react"
import { createPresencePair } from "../presence"
import { DocumentFooter, LoadingBoard, useDemoStore } from "../shared"
import type { BoardPresence } from "@kritzlboard/react"

function PeerBadge({ presence }: { presence: BoardPresence }) {
  const peers = usePeers(presence)
  return <span className="peer-badge">{peers.map((peer) => <span key={peer.clientId}><span className="peer-dot" style={{ background: peer.user.color }} />{peer.user.name} is here</span>)}</span>
}

export function PresenceExample() {
  const store = useDemoStore("shared-local-document", "green")
  // Creation only allocates local state, so the Strict Mode initializer is safe.
  const [presence] = useState(createPresencePair)
  if (!store) return <LoadingBoard />
  return (
    <>
      <div className="presence-note"><span className="status-dot" /> Local presence demo · two views of one document</div>
      <div className="paired-boards presence-boards">
        {presence.map((endpoint, index) => (
          <section className="small-board-card" key={index}>
            <div className="small-board-heading"><h3>{index === 0 ? "Alex's view" : "Sam's view"}</h3><PeerBadge presence={endpoint} /></div>
            <div className="small-canvas"><Board store={store} presence={endpoint} aria-label={index === 0 ? "Alex's shared board" : "Sam's shared board"} initialStyle={{ color: index === 0 ? "blue" : "violet", font: "hand" }} /></div>
          </section>
        ))}
      </div>
      <DocumentFooter store={store} color="green" />
      <p className="example-footnote">Both editors share a local core store. The adapter forwards cursor and selection updates inside this page. For remote collaboration, connect a separate core store per client with @kritzlboard/sync.</p>
    </>
  )
}
