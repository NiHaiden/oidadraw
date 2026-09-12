import { StrictMode, useEffect } from "react"
import { createRoot } from "react-dom/client"
import {
  Board,
  BoardStylePanel,
  BoardZoomControls,
  useBoardEditor,
  useBoardStore,
} from "@kritzlboard/react"
import "@kritzlboard/react/styles.css"
import "@fontsource-variable/inter/index.css"
import "@fontsource-variable/caveat/index.css"
import "./styles.css"
import type { ColorId } from "@kritzlboard/core"

function CustomTools() {
  const editor = useBoardEditor()
  return (
    <>
      <div className="custom-tools" aria-label="Custom board controls">
        <button type="button" onClick={() => editor.setTool("select")}>
          Select
        </button>
        <button type="button" onClick={() => editor.setTool("draw")}>
          Pen
        </button>
        <button type="button" onClick={() => editor.setTool("rect")}>
          Rectangle
        </button>
        <button type="button" onClick={() => editor.deleteSelection()}>
          Delete
        </button>
        <span>{editor.tool}</span>
      </div>
      <BoardStylePanel />
      <BoardZoomControls />
    </>
  )
}

function DemoBoard({
  id,
  color,
  custom = false,
}: {
  id: string
  color: ColorId
  custom?: boolean
}) {
  const store = useBoardStore(id)
  useEffect(() => {
    if (!store || store.getShapes().length) return
    store.putShapes([
      {
        id: "first",
        type: "rect",
        order: 1,
        color,
        size: "m",
        fill: "semi",
        x: -205,
        y: -70,
        w: 160,
        h: 140,
        text: "Move me",
        font: "hand",
      },
      {
        id: "second",
        type: "ellipse",
        order: 2,
        color,
        size: "m",
        fill: "none",
        x: 75,
        y: -70,
        w: 140,
        h: 140,
        text: "Connected",
        font: "hand",
      },
      {
        id: "arrow",
        type: "arrow",
        order: 3,
        color,
        size: "m",
        x: -45,
        y: 0,
        dx: 120,
        dy: 0,
        startBinding: "first",
        endBinding: "second",
      },
    ])
    store.undoManager.clear()
  }, [store, color])
  return store ? (
    <Board
      store={store}
      aria-label={`${id} drawing board`}
      controls={!custom}
      initialStyle={{ color }}
    >
      {custom && <CustomTools />}
    </Board>
  ) : null
}

function Example() {
  return (
    <main>
      <p className="eyebrow">@kritzlboard/react</p>
      <h1>Two boards. Your application.</h1>
      <p className="intro">
        Draw, resize a card, or switch between boards. Each has its own tools,
        selection, clipboard, and undo history.
      </p>
      <div className="boards">
        <section>
          <header>
            <h2>Default controls</h2>
            <span>Local document</span>
          </header>
          <div className="board-frame">
            <DemoBoard id="Default" color="blue" />
          </div>
        </section>
        <section>
          <header>
            <h2>Custom controls</h2>
            <span>Same editor API</span>
          </header>
          <div className="board-frame">
            <DemoBoard id="Custom" color="violet" custom />
          </div>
        </section>
      </div>
      <label className="host-field">
        Notes in the host application
        <textarea placeholder="Type here. Board shortcuts leave this field alone." />
      </label>
      <p className="note">
        This example uses the built package exports. No router, authentication,
        backend, or Tailwind is required.
      </p>
    </main>
  )
}

const root = createRoot(document.getElementById("root")!)
root.render(
  <StrictMode>
    <Example />
  </StrictMode>
)

if (import.meta.hot) import.meta.hot.dispose(() => root.unmount())
