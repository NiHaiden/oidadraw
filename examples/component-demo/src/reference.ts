export type ApiEntry = {
  id: string
  name: string
  kind: "component" | "hook" | "type"
  summary: string
  signature: string
  usage: string
  details: string[]
  props?: Array<{
    name: string
    type: string
    defaultValue: string
    description: string
  }>
}

const optionProps: NonNullable<ApiEntry["props"]> = [
  { name: "store", type: "BoardStore", defaultValue: "Required", description: "The core document to edit. The host owns its lifetime." },
  { name: "presence", type: "BoardPresence", defaultValue: "undefined", description: "Optional peer cursor and selection adapter. Content synchronization is configured separately." },
  { name: "initialStyle", type: "Partial<StyleDefaults>", defaultValue: "black, no fill, solid stroke, medium size, sans font, medium text", description: "Drawing defaults for a new editor session. Later prop changes do not reset the current style." },
  { name: "onStyleChange", type: "(style: StyleDefaults) => void", defaultValue: "undefined", description: "Receives the complete style after mount and on changes. Use a stable callback to save preferences." },
]

export const apiReference: ApiEntry[] = [
  {
    id: "board", name: "Board", kind: "component",
    summary: "A complete whiteboard with a canvas, toolbar, style panel, and zoom controls.",
    signature: "Board(props: BoardProps)",
    usage: `import { Board, useBoardStore } from "@kritzlboard/react"
import "@kritzlboard/react/styles.css"

export function Sketch() {
  const store = useBoardStore("sketch")
  return (
    <div style={{ height: 480 }}>
      {store && <Board store={store} aria-label="Project sketch" />}
    </div>
  )
}`,
    details: [
      "Give the parent a definite height and import the package stylesheet once. The board fills its container and responds to resizing.",
      "Set controls={false} to remove all default controls. Children render inside the board's provider and root, after the canvas and default controls.",
      "Each editor keeps its own camera, selection, tool, style, and clipboard. Shortcuts apply within the focused board and ignore text inputs.",
      "The supplied store and presence transport are never destroyed by Board. Replacing the document starts a fresh editor session.",
    ],
    props: [...optionProps,
      { name: "controls", type: "boolean", defaultValue: "true", description: "Include the default toolbar, style panel, and zoom controls." },
      { name: "children", type: "ReactNode", defaultValue: "undefined", description: "Custom controls or overlays inside BoardRoot." },
      { name: "Root attributes", type: "Omit<HTMLAttributes<HTMLDivElement>, 'onChange'>", defaultValue: "aria-label: Drawing board", description: "Pass className, style, aria-label, and other supported div attributes to the root." },
    ],
  },
  {
    id: "board-provider", name: "BoardProvider", kind: "component",
    summary: "Shares local editor state between a canvas and your controls.",
    signature: "BoardProvider(props: BoardOptions & { children: ReactNode })",
    usage: `import {
  BoardProvider, BoardRoot, BoardCanvas, BoardToolbar,
} from "@kritzlboard/react"
import type { BoardStore } from "@kritzlboard/core"
import "@kritzlboard/react/styles.css"

export function CustomBoard({ store }: { store: BoardStore }) {
  return (
    <BoardProvider store={store}>
      <BoardRoot style={{ height: 480 }}>
        <BoardCanvas />
        <BoardToolbar />
      </BoardRoot>
    </BoardProvider>
  )
}`,
    details: [
      "Use one BoardRoot and one BoardCanvas per provider. The provider itself renders no layout container.",
      "Board already includes a provider; custom children of Board can call useBoardEditor directly.",
      "The provider owns editor state, while the host owns the supplied store and transport. A new document resets the editor session.",
    ],
    props: [...optionProps, { name: "children", type: "ReactNode", defaultValue: "Required", description: "The board root, canvas, and components that consume editor state." }],
  },
  {
    id: "board-root", name: "BoardRoot", kind: "component",
    summary: "The board's focusable, resizable layout and keyboard boundary.",
    signature: "BoardRoot(props: HTMLAttributes<HTMLDivElement>)",
    usage: `// Inside a BoardProvider:
<BoardRoot style={{ height: 480 }} aria-label="Design canvas">
  <BoardCanvas />
  <BoardToolbar />
</BoardRoot>`,
    details: [
      "Requires BoardProvider. Keep one root per provider and put the canvas and controls inside it.",
      "Defaults to a focusable region labelled Drawing board. The implementation sets role=region and tabIndex=0.",
      "A supplied className is added to kb-root. The root supplies cursor styling, measures container changes, and scopes keyboard shortcuts.",
    ],
    props: [
      { name: "children", type: "ReactNode", defaultValue: "undefined", description: "The canvas, controls, and overlays." },
      { name: "className", type: "string", defaultValue: "Empty string", description: "Additional root classes; kb-root is retained." },
      { name: "style", type: "CSSProperties", defaultValue: "undefined", description: "Set dimensions or inline root styling. A definite height is required." },
      { name: "aria-label", type: "string", defaultValue: "Drawing board", description: "An accessible name, especially useful for multiple boards." },
      { name: "Other div attributes", type: "HTMLAttributes<HTMLDivElement>", defaultValue: "undefined", description: "Standard div attributes are forwarded; root role, tabIndex, and internal data attributes are set by the component." },
    ],
  },
  {
    id: "board-canvas", name: "BoardCanvas", kind: "component",
    summary: "The interactive SVG drawing surface and editing overlays.",
    signature: "BoardCanvas()",
    usage: `// Inside BoardProvider > BoardRoot:
<BoardCanvas />`,
    details: [
      "Takes no props. Reads document, camera, tools, selection, and optional presence from its provider.",
      "Renders the grid, shapes, selection and connector overlays, peer cursors, and the text editor.",
      "Requires one BoardRoot in the same provider. Add controls as siblings; they are not included by BoardCanvas.",
    ],
  },
  {
    id: "board-toolbar", name: "BoardToolbar", kind: "component",
    summary: "The default tool picker with undo and redo.",
    signature: "BoardToolbar()",
    usage: `// Inside BoardProvider > BoardRoot, alongside BoardCanvas:
<BoardToolbar />`,
    details: [
      "Takes no props. Requires BoardProvider and uses the current editor's tool and store.",
      "Includes selection, hand, freehand, eraser, rectangle, ellipse, line, arrow, and text tools.",
      "Undo and redo buttons reflect the store's history. Buttons use type=button so embedding inside a host form does not submit it.",
      "For a custom picker, use useBoardEditor().setTool with ToolId values from @kritzlboard/core.",
    ],
  },
  {
    id: "board-style-panel", name: "BoardStylePanel", kind: "component",
    summary: "Contextual controls for color, fill, stroke, size, and text style.",
    signature: "BoardStylePanel()",
    usage: `// Inside BoardProvider > BoardRoot, alongside BoardCanvas:
<BoardStylePanel />`,
    details: [
      "Takes no props. Requires BoardProvider and derives controls from the active tool and selected shapes.",
      "Hidden until a drawing tool is active or a shape is selected. Fill, stroke, font, and size controls appear when applicable.",
      "Changes update drawing defaults and relevant properties of selected shapes through editor.changeStyle.",
      "Use initialStyle and onStyleChange on the provider to initialize and save preferences; this component does not access localStorage.",
    ],
  },
  {
    id: "board-zoom-controls", name: "BoardZoomControls", kind: "component",
    summary: "Zoom in, zoom out, reset to 100%, and fit document content.",
    signature: "BoardZoomControls()",
    usage: `// Inside BoardProvider > BoardRoot, alongside BoardCanvas:
<BoardZoomControls />`,
    details: [
      "Takes no props. Requires BoardProvider and operates on that editor's camera.",
      "Calculations use the embedded canvas dimensions. Camera state is local to the editor and is not written to the document.",
      "Use useBoardEditor for custom zoom controls or to display the current camera.z scale.",
    ],
  },
  {
    id: "shape-view", name: "ShapeView", kind: "component",
    summary: "Render one shape in your own SVG, without an interactive board.",
    signature: "ShapeView(props: { shape: Shape; fadeOut?: boolean; hideLabel?: boolean })",
    usage: `import { ShapeView } from "@kritzlboard/react"
import type { Shape } from "@kritzlboard/core"
import "@kritzlboard/react/styles.css"

const shape: Shape = {
  id: "preview", type: "rect", order: 0,
  x: 20, y: 20, w: 180, h: 100,
  color: "blue", size: "m", fill: "semi", text: "Preview",
}

export function Preview() {
  return (
    <svg viewBox="0 0 220 140" role="img" aria-label="Shape preview">
      <ShapeView shape={shape} />
    </svg>
  )
}`,
    details: [
      "Does not require BoardProvider. Render within an SVG because it returns SVG elements.",
      "Renders geometry and text only: no camera, selection, editing, or synchronization behavior.",
      "hideLabel hides labels on rectangles, ellipses, lines, and arrows. It does not hide standalone text shapes.",
    ],
    props: [
      { name: "shape", type: "Shape", defaultValue: "Required", description: "A core shape with geometry in SVG coordinates." },
      { name: "fadeOut", type: "boolean", defaultValue: "false", description: "Render at 0.4 opacity." },
      { name: "hideLabel", type: "boolean", defaultValue: "false", description: "Hide an attached label while leaving its geometry visible." },
    ],
  },
  {
    id: "use-board-store", name: "useBoardStore", kind: "hook",
    summary: "Create and clean up an in-memory document with React's lifecycle.",
    signature: "useBoardStore(boardId?: string): BoardStore | null",
    usage: `import { Board, useBoardStore } from "@kritzlboard/react"
import "@kritzlboard/react/styles.css"

export function LocalBoard() {
  const store = useBoardStore("local-sketch")
  if (!store) return <p>Preparing the canvas…</p>
  return <Board store={store} style={{ height: 480 }} />
}`,
    details: [
      "The ID defaults to local. Returns null until its mount effect creates the store, including during server rendering.",
      "Destroys the created store on unmount or an ID change and supports Strict Mode. Do not destroy this store separately.",
      "IDs label documents; two calls with the same ID create independent stores. No persistence or network connection is added.",
      "No provider is required. Supply a host-owned core BoardStore when its lifetime should outlive a component.",
    ],
  },
  {
    id: "use-board-editor", name: "useBoardEditor", kind: "hook",
    summary: "Read local editor state and issue commands from custom controls.",
    signature: "useBoardEditor(): BoardEditor",
    usage: `import { useBoardEditor } from "@kritzlboard/react"

// Render as a child of Board, or inside BoardProvider.
export function PenButton() {
  const editor = useBoardEditor()
  return (
    <button type="button" aria-pressed={editor.tool === "draw"}
      onClick={() => editor.setTool("draw")}>
      Pen
    </button>
  )
}`,
    details: [
      "Requires BoardProvider; throws outside it. Board includes a provider for its children.",
      "Exposes store, camera, tool, selection, selectedShapes, style, and editing commands. See BoardEditor for every member.",
      "Undo and redo live on editor.store; use useCanUndoRedo(editor.store) for action availability.",
    ],
  },
  {
    id: "use-shapes", name: "useShapes", kind: "hook",
    summary: "Subscribe to a document's ordered shape snapshot.",
    signature: "useShapes(store: BoardStore): Shape[]",
    usage: `import { useShapes } from "@kritzlboard/react"
import type { BoardStore } from "@kritzlboard/core"

export function ShapeCount({ store }: { store: BoardStore }) {
  const shapes = useShapes(store)
  return <output>{shapes.length} shapes</output>
}`,
    details: [
      "No provider is required. Updates when the core store publishes a document change.",
      "Treat the snapshot as read-only. Use store methods for edits rather than mutating shapes or the array.",
      "For an SVG preview, map the snapshot to ShapeView components using shape.id as the React key.",
    ],
  },
  {
    id: "use-peers", name: "usePeers", kind: "hook",
    summary: "Subscribe to an optional presence adapter's current peers.",
    signature: "usePeers(presence?: BoardPresence): PeerState[]",
    usage: `import { usePeers } from "@kritzlboard/react"
import type { BoardPresence } from "@kritzlboard/react"

export function People({ presence }: { presence?: BoardPresence }) {
  const peers = usePeers(presence)
  return <ul>{peers.map((peer) => (
    <li key={peer.clientId}>{peer.user.name}</li>
  ))}</ul>
}`,
    details: [
      "No provider is required. Returns a stable empty array without an adapter and an empty array during server rendering.",
      "Adapters must provide stable, bound subscribe/getPeers functions and a cached snapshot until peers change.",
      "@kritzlboard/sync BoardConnection implements this interface. This hook does not create or close a connection.",
    ],
  },
  {
    id: "use-board-name", name: "useBoardName", kind: "hook",
    summary: "Read and subscribe to the document's title.",
    signature: "useBoardName(store: BoardStore): string",
    usage: `import { useBoardName } from "@kritzlboard/react"
import type { BoardStore } from "@kritzlboard/core"

export function BoardTitle({ store }: { store: BoardStore }) {
  const name = useBoardName(store)
  return <h2>{name || "Untitled board"}</h2>
}`,
    details: [
      "No provider is required. Rerenders when the core store's board name changes.",
      "Rename through store.setBoardName(name). A connected document can share its title alongside its shapes.",
    ],
  },
  {
    id: "use-can-undo-redo", name: "useCanUndoRedo", kind: "hook",
    summary: "Subscribe to whether the document has an undo or redo action.",
    signature: "useCanUndoRedo(store: BoardStore): { canUndo: boolean; canRedo: boolean }",
    usage: `import { useCanUndoRedo } from "@kritzlboard/react"
import type { BoardStore } from "@kritzlboard/core"

export function HistoryButtons({ store }: { store: BoardStore }) {
  const { canUndo, canRedo } = useCanUndoRedo(store)
  return <>
    <button type="button" disabled={!canUndo} onClick={() => store.undo()}>Undo</button>
    <button type="button" disabled={!canRedo} onClick={() => store.redo()}>Redo</button>
  </>
}`,
    details: [
      "No provider is required. Subscribes to both history flags on the supplied store.",
      "Returns availability only. Execute actions with store.undo() and store.redo().",
    ],
  },
  {
    id: "board-props", name: "BoardProps", kind: "type",
    summary: "The complete prop contract for the ready-to-use Board component.",
    signature: "interface BoardProps extends BoardOptions, Omit<HTMLAttributes<HTMLDivElement>, 'onChange'> { controls?: boolean }",
    usage: `import { Board } from "@kritzlboard/react"
import type { BoardProps } from "@kritzlboard/react"

export function BrandedBoard(props: BoardProps) {
  const className = ["brand-board", props.className].filter(Boolean).join(" ")
  return <Board {...props} className={className} />
}`,
    details: [
      "Combines the required store and optional presence/style options with HTML div attributes and controls.",
      "HTML onChange is omitted. Use onStyleChange for style preferences and useShapes or store.subscribe for document changes.",
      "There is no value/onChange document prop and no readOnly prop. Use the core store for content and ShapeView for noninteractive previews.",
    ],
    props: [...optionProps, { name: "controls", type: "boolean", defaultValue: "true", description: "Enable the default toolbar, style panel, and zoom controls." }],
  },
  {
    id: "board-options", name: "BoardOptions", kind: "type",
    summary: "Shared document, presence, and drawing-preference options.",
    signature: "interface BoardOptions { store: BoardStore; presence?: BoardPresence; initialStyle?: Partial<StyleDefaults>; onStyleChange?: (style: StyleDefaults) => void }",
    usage: `import { Board } from "@kritzlboard/react"
import type { BoardOptions } from "@kritzlboard/react"
import type { BoardStore } from "@kritzlboard/core"

export function BlueBoard({ store }: { store: BoardStore }) {
  const options: BoardOptions = {
    store,
    initialStyle: { color: "blue", fill: "semi", font: "sans" },
  }
  return <Board {...options} style={{ height: 480 }} />
}`,
    details: [
      "Accepted by Board and BoardProvider. Only store is required.",
      "StyleDefaults contains color, fill, strokeStyle, size, font, and textSize. initialStyle is merged with defaults once per session.",
      "Use editor.changeStyle for live updates. onStyleChange receives complete preferences, including the initial mounted state.",
    ],
    props: optionProps,
  },
  {
    id: "board-presence", name: "BoardPresence", kind: "type",
    summary: "A transport-neutral contract for peer cursors and selections.",
    signature: `interface BoardPresence {
  subscribe: (listener: () => void) => () => void
  getPeers: () => PeerState[]
  setCursor: (cursor: { x: number; y: number } | null) => void
  setSelectionPresence: (selection: string[]) => void
}`,
    usage: `import { Board } from "@kritzlboard/react"
import type { BoardPresence } from "@kritzlboard/react"
import type { BoardStore } from "@kritzlboard/core"

export function SharedBoard(props: {
  store: BoardStore
  presence: BoardPresence
}) {
  // A BoardConnection from @kritzlboard/sync can supply presence.
  return <Board {...props} style={{ height: 480 }} />
}`,
    details: [
      "Handles presence only. Synchronize store.doc separately, or use @kritzlboard/sync for document sync and presence.",
      "Use stable, bound functions. getPeers returns the same array until peers change; notify subscribed listeners after changes.",
      "PeerState contains clientId, user, cursor, and selection. Cursors use world coordinates, not browser pixel coordinates.",
      "The editor clears its cursor and selection on cleanup. The host is responsible for disconnecting the transport.",
    ],
    props: [
      { name: "subscribe", type: "(listener: () => void) => () => void", defaultValue: "Required", description: "Register a listener and return its unsubscribe function." },
      { name: "getPeers", type: "() => PeerState[]", defaultValue: "Required", description: "Return the cached peer snapshot." },
      { name: "setCursor", type: "(cursor: { x: number; y: number } | null) => void", defaultValue: "Required", description: "Publish a world-coordinate cursor, or null to clear it." },
      { name: "setSelectionPresence", type: "(selection: string[]) => void", defaultValue: "Required", description: "Publish selected shape IDs; an empty array clears the selection." },
    ],
  },
  {
    id: "board-editor", name: "BoardEditor", kind: "type",
    summary: "Local view state and commands returned by useBoardEditor.",
    signature: `interface BoardEditor {
  store: BoardStore
  camera: Camera
  tool: ToolId
  selection: ReadonlySet<string>
  selectedShapes: Shape[]
  style: StyleDefaults
  setTool: (tool: ToolId) => void
  setSelection: (selection: ReadonlySet<string>) => void
  changeStyle: (patch: Partial<StyleDefaults>) => void
  deleteSelection: () => void
  duplicateSelection: () => void
  selectAll: () => void
  zoomIn: () => void
  zoomOut: () => void
  resetZoom: () => void
  zoomToFit: () => void
}`,
    usage: `import { useBoardEditor } from "@kritzlboard/react"
import type { BoardEditor } from "@kritzlboard/react"

function highlight(editor: BoardEditor) {
  editor.changeStyle({ color: "violet" })
}

export function HighlightButton() {
  const editor = useBoardEditor()
  return (
    <button type="button" disabled={editor.selection.size === 0}
      onClick={() => highlight(editor)}>
      Highlight selection
    </button>
  )
}`,
    details: [
      "Obtain this object with useBoardEditor inside a provider. Treat state as read-only and use the commands to change it.",
      "Editor state is local even when the document is shared. Camera and active tool are not document properties.",
      "Selection commands schedule a React update. Run a selection-dependent command after the new selection renders, rather than immediately after setSelection/selectAll.",
      "Use store.undo() and store.redo() for history. No undo/redo or arbitrary setCamera methods are exposed directly on BoardEditor.",
    ],
    props: [
      { name: "store", type: "BoardStore", defaultValue: "Supplied store", description: "Document access, mutations, and history." },
      { name: "camera", type: "Camera", defaultValue: "Container-centered at scale 1", description: "Current world origin x/y and zoom factor z." },
      { name: "tool", type: "ToolId", defaultValue: "select", description: "The active tool." },
      { name: "selection", type: "ReadonlySet<string>", defaultValue: "Empty set", description: "Selected shape IDs." },
      { name: "selectedShapes", type: "Shape[]", defaultValue: "Empty array", description: "Current document shapes represented by selection." },
      { name: "style", type: "StyleDefaults", defaultValue: "initialStyle merged with defaults", description: "Current drawing preferences." },
      { name: "setTool", type: "(tool: ToolId) => void", defaultValue: "—", description: "Select a drawing, selection, hand, or eraser tool." },
      { name: "setSelection", type: "(selection: ReadonlySet<string>) => void", defaultValue: "—", description: "Replace selection with a new set of shape IDs." },
      { name: "changeStyle", type: "(patch: Partial<StyleDefaults>) => void", defaultValue: "—", description: "Update preferences and applicable properties of selected shapes." },
      { name: "deleteSelection", type: "() => void", defaultValue: "—", description: "Delete selected shapes from the document." },
      { name: "duplicateSelection", type: "() => void", defaultValue: "—", description: "Create offset copies of selected shapes." },
      { name: "selectAll", type: "() => void", defaultValue: "—", description: "Select all document shapes." },
      { name: "zoomIn", type: "() => void", defaultValue: "—", description: "Increase zoom around the canvas center." },
      { name: "zoomOut", type: "() => void", defaultValue: "—", description: "Decrease zoom around the canvas center." },
      { name: "resetZoom", type: "() => void", defaultValue: "—", description: "Reset scale to 100% around the canvas center." },
      { name: "zoomToFit", type: "() => void", defaultValue: "—", description: "Fit all document shapes in the canvas." },
    ],
  },
]
