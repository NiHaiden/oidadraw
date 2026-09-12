import type {
  BoardStore,
  Camera,
  PeerState,
  Shape,
  StyleDefaults,
  ToolId,
} from "@kritzlboard/core"

/** Optional transport-neutral presence. Snapshots must be cached until changed. */
export interface BoardPresence {
  subscribe: (listener: () => void) => () => void
  getPeers: () => Array<PeerState>
  setCursor: (cursor: { x: number; y: number } | null) => void
  setSelectionPresence: (selection: Array<string>) => void
}

export interface BoardOptions {
  store: BoardStore
  presence?: BoardPresence
  initialStyle?: Partial<StyleDefaults>
  onStyleChange?: (style: StyleDefaults) => void
}

/** Local editor state and commands shared by the canvas and custom controls. */
export interface BoardEditor {
  store: BoardStore
  camera: Camera
  tool: ToolId
  selection: ReadonlySet<string>
  selectedShapes: Array<Shape>
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
}
