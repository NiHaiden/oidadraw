import { createContext, useContext } from "react"
import { useBoardController } from "./useBoardController.js"
import type { ReactNode } from "react"
import type { BoardEditor, BoardOptions } from "./types.js"

type BoardContextValue = ReturnType<typeof useBoardController>
const BoardContext = createContext<BoardContextValue | null>(null)

function BoardSession({
  children,
  ...options
}: BoardOptions & { children: ReactNode }) {
  const value = useBoardController(options)
  return <BoardContext.Provider value={value}>{children}</BoardContext.Provider>
}

/** Owns view state, never the supplied store or presence transport. */
export function BoardProvider(props: BoardOptions & { children: ReactNode }) {
  return <BoardSession key={props.store.doc.guid} {...props} />
}

export function useBoardContext(): BoardContextValue {
  const context = useContext(BoardContext)
  if (!context)
    throw new Error("Board components must be inside a BoardProvider")
  return context
}

export function useBoardEditor(): BoardEditor {
  return useBoardContext().editor
}
