import { Board } from "@kritzlboard/react"
import { DocumentFooter, LoadingBoard, useDemoStore } from "../shared"

export function CompleteBoard() {
  const store = useDemoStore("complete-board")
  if (!store) return <LoadingBoard />
  return (
    <>
      <div className="demo-canvas resizable-canvas">
        <Board store={store} aria-label="Complete board example" initialStyle={{ color: "blue", font: "hand" }} />
      </div>
      <DocumentFooter store={store} />
    </>
  )
}
