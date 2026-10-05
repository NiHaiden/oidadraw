import { useState } from "react"
import { BoardCanvas, BoardProvider, BoardRoot, BoardStylePanel, BoardToolbar, BoardZoomControls } from "@kritzlboard/react"
import { DocumentFooter, LoadingBoard, useDemoStore } from "../shared"

export function ComposedBoard() {
  const store = useDemoStore("composed-board", "green")
  const [toolbar, setToolbar] = useState(true)
  const [stylePanel, setStylePanel] = useState(true)
  const [zoom, setZoom] = useState(true)
  if (!store) return <LoadingBoard />
  return (
    <>
      <fieldset className="example-options">
        <legend>Choose the controls</legend>
        <label><input type="checkbox" checked={toolbar} onChange={(event) => setToolbar(event.target.checked)} /> Toolbar</label>
        <label><input type="checkbox" checked={stylePanel} onChange={(event) => setStylePanel(event.target.checked)} /> Style panel</label>
        <label><input type="checkbox" checked={zoom} onChange={(event) => setZoom(event.target.checked)} /> Zoom controls</label>
      </fieldset>
      <BoardProvider store={store} initialStyle={{ color: "green", font: "hand" }}>
        <BoardRoot className="composed-canvas" aria-label="Composed board example">
          <BoardCanvas />
          <span className="canvas-caption">Your layout. The same editor.</span>
          {toolbar && <BoardToolbar />}
          {stylePanel && <BoardStylePanel />}
          {zoom && <BoardZoomControls />}
        </BoardRoot>
      </BoardProvider>
      <DocumentFooter store={store} color="green" />
    </>
  )
}
