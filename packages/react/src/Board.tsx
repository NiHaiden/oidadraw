import { BoardProvider, useBoardContext, useBoardEditor } from "./context.js"
import { BoardCanvas } from "./BoardCanvas.js"
import { Toolbar } from "./Toolbar.js"
import { StylePanel } from "./StylePanel.js"
import { ZoomBar } from "./ZoomBar.js"
import type { HTMLAttributes } from "react"
import type { BoardOptions } from "./types.js"

export function BoardRoot({
  children,
  className = "",
  onBlur,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  const {
    rootRef,
    spaceDown,
    clearSpace,
    editor: { tool },
  } = useBoardContext()
  const cursor =
    tool === "hand" || spaceDown
      ? "grab"
      : tool === "select"
        ? "default"
        : tool === "text"
          ? "text"
          : "crosshair"
  return (
    <div
      {...props}
      ref={rootRef}
      data-kritzlboard-root=""
      data-cursor={cursor}
      className={`kb-root ${className}`}
      role="region"
      aria-label={props["aria-label"] ?? "Drawing board"}
      tabIndex={0}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) clearSpace()
        onBlur?.(event)
      }}
    >
      {children}
    </div>
  )
}

export function BoardToolbar() {
  const { store, tool, setTool } = useBoardEditor()
  return <Toolbar store={store} tool={tool} onToolChange={setTool} />
}

export function BoardStylePanel() {
  const { tool, selectedShapes, style, changeStyle } = useBoardEditor()
  return (
    <StylePanel
      tool={tool}
      selectedShapes={selectedShapes}
      style={style}
      onChange={changeStyle}
    />
  )
}

export function BoardZoomControls() {
  const { camera, zoomIn, zoomOut, resetZoom, zoomToFit } = useBoardEditor()
  return (
    <ZoomBar
      zoom={camera.z}
      onZoomIn={zoomIn}
      onZoomOut={zoomOut}
      onZoomReset={resetZoom}
      onZoomToFit={zoomToFit}
    />
  )
}

export interface BoardProps
  extends BoardOptions, Omit<HTMLAttributes<HTMLDivElement>, "onChange"> {
  controls?: boolean
}

/** Ready-to-use composition. The host supplies a container with a definite height. */
export function Board({
  store,
  presence,
  initialStyle,
  onStyleChange,
  controls = true,
  children,
  ...rootProps
}: BoardProps) {
  return (
    <BoardProvider
      store={store}
      presence={presence}
      initialStyle={initialStyle}
      onStyleChange={onStyleChange}
    >
      <BoardRoot {...rootProps}>
        <BoardCanvas />
        {controls && (
          <>
            <BoardToolbar />
            <BoardStylePanel />
            <BoardZoomControls />
          </>
        )}
        {children}
      </BoardRoot>
    </BoardProvider>
  )
}
