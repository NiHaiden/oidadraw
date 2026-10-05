import { Board } from "@kritzlboard/react"
import { DocumentFooter, LoadingBoard, useDemoStore } from "../shared"
import type { ColorId } from "@kritzlboard/core"

function IndependentBoard({ title, color }: { title: string; color: ColorId }) {
  const store = useDemoStore(title, color)
  if (!store) return <LoadingBoard />
  return (
    <section className="small-board-card">
      <div className="small-board-heading"><span className={`board-dot dot-${color}`} /><h3>{title}</h3><span>Local document</span></div>
      <div className="small-canvas"><Board store={store} aria-label={`${title} independent board`} initialStyle={{ color, font: "hand" }} /></div>
      <DocumentFooter store={store} color={color} />
    </section>
  )
}

export function MultipleBoards() {
  return (
    <div className="multiple-example">
      <div className="paired-boards"><IndependentBoard title="First canvas" color="blue" /><IndependentBoard title="Second canvas" color="violet" /></div>
      <label className="host-input"><span>A field in your application</span><input placeholder="Try typing V, R, or Delete here. Only this field receives your input." /></label>
    </div>
  )
}
