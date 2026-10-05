import { COLOR_IDS, PALETTE } from "@kritzlboard/core"
import { BoardCanvas, BoardProvider, BoardRoot, BoardStylePanel, BoardZoomControls, useBoardEditor, useCanUndoRedo } from "@kritzlboard/react"
import { DocumentFooter, LoadingBoard, useDemoStore } from "../shared"
import type { ToolId } from "@kritzlboard/core"

const tools: Array<{ id: ToolId; label: string }> = [
  { id: "select", label: "Select" }, { id: "draw", label: "Pen" },
  { id: "rect", label: "Rectangle" }, { id: "arrow", label: "Arrow" },
  { id: "text", label: "Text" },
]

function EditorActions() {
  const editor = useBoardEditor()
  const { canUndo, canRedo } = useCanUndoRedo(editor.store)
  return (
    <div className="custom-actions" aria-label="Custom editor actions">
      <div className="action-group" aria-label="Drawing tools">
        {tools.map((tool) => <button key={tool.id} type="button" aria-pressed={editor.tool === tool.id} onClick={() => editor.setTool(tool.id)}>{tool.label}</button>)}
      </div>
      <div className="action-group">
        <button type="button" onClick={() => editor.selectAll()}>Select all</button>
        <button type="button" disabled={!editor.selection.size} onClick={() => editor.duplicateSelection()}>Duplicate</button>
        <button type="button" disabled={!editor.selection.size} onClick={() => editor.deleteSelection()}>Delete</button>
      </div>
      <div className="action-group">
        <button type="button" disabled={!canUndo} onClick={() => editor.store.undo()}>Undo</button>
        <button type="button" disabled={!canRedo} onClick={() => editor.store.redo()}>Redo</button>
      </div>
    </div>
  )
}

function SelectionInspector() {
  const editor = useBoardEditor()
  return (
    <aside className="selection-inspector" aria-label="Live editor state">
      <div className="inspector-title"><span className="status-dot" /> Live editor state</div>
      <dl>
        <div><dt>Active tool</dt><dd>{editor.tool}</dd></div>
        <div><dt>Selection</dt><dd>{editor.selection.size} shapes</dd></div>
        <div><dt>Zoom</dt><dd>{Math.round(editor.camera.z * 100)}%</dd></div>
      </dl>
      <p>Change a drawing default, or recolor your selected shapes.</p>
      <div className="inspector-colors">
        {COLOR_IDS.map((color) => <button key={color} type="button" aria-label={`Use ${color}`} aria-pressed={editor.style.color === color} style={{ backgroundColor: PALETTE[color].stroke }} onClick={() => editor.changeStyle({ color })} />)}
      </div>
      <button className="wide-action" type="button" onClick={() => editor.zoomToFit()}>Fit all shapes</button>
      {editor.selectedShapes.length > 0 && <pre className="selection-json">{JSON.stringify(editor.selectedShapes.map(({ id, type, color }) => ({ id, type, color })), null, 2)}</pre>}
    </aside>
  )
}

export function CustomControls() {
  const store = useDemoStore("custom-controls", "violet")
  if (!store) return <LoadingBoard />
  return (
    <>
      <BoardProvider store={store} initialStyle={{ color: "violet", font: "hand" }}>
        <EditorActions />
        <div className="inspector-layout">
          <BoardRoot className="custom-canvas" aria-label="Custom controls example">
            <BoardCanvas />
            <BoardStylePanel />
            <BoardZoomControls />
          </BoardRoot>
          <SelectionInspector />
        </div>
      </BoardProvider>
      <DocumentFooter store={store} color="violet" />
    </>
  )
}
