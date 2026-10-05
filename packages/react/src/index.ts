"use client"

export {
  Board,
  BoardRoot,
  BoardToolbar,
  BoardStylePanel,
  BoardZoomControls,
} from "./Board.js"
export type { BoardProps } from "./Board.js"
export { BoardProvider, useBoardEditor } from "./context.js"
export { BoardCanvas } from "./BoardCanvas.js"
export { ShapeView } from "./ShapeView.js"
export {
  useBoardStore,
  useShapes,
  usePeers,
  useBoardName,
  useCanUndoRedo,
} from "./hooks.js"
export type { BoardEditor, BoardOptions, BoardPresence } from "./types.js"
