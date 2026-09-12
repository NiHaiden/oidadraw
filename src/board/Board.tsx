import { Board as ReactBoard } from "@kritzlboard/react"
import { TopBar } from "./TopBar"
import type { BoardStore } from "./store"
import type { StyleDefaults } from "@kritzlboard/core"

const STYLE_KEY = "kritzlboard:style"

function loadStyle(): Partial<StyleDefaults> {
  try {
    return JSON.parse(localStorage.getItem(STYLE_KEY) ?? "{}")
  } catch {
    return {}
  }
}

function saveStyle(style: StyleDefaults) {
  try {
    localStorage.setItem(STYLE_KEY, JSON.stringify(style))
  } catch {
    // Browser preferences are optional in private browsing.
  }
}

export function Board({ store }: { store: BoardStore }) {
  return (
    <div className="application-board">
      <ReactBoard
        store={store}
        presence={store}
        initialStyle={loadStyle()}
        onStyleChange={saveStyle}
      >
        <TopBar store={store} />
      </ReactBoard>
    </div>
  )
}
