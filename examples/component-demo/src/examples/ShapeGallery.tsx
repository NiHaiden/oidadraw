import { useState } from "react"
import { ShapeView } from "@kritzlboard/react"
import type { Shape } from "@kritzlboard/core"

const samples: Array<{ title: string; shape: Shape }> = [
  { title: "Rectangle", shape: { id: "rect", type: "rect", order: 1, color: "blue", size: "m", fill: "semi", x: 35, y: 30, w: 190, h: 115, text: "A little structure", font: "hand", textSize: "s" } },
  { title: "Ellipse", shape: { id: "ellipse", type: "ellipse", order: 1, color: "violet", size: "m", fill: "semi", x: 45, y: 22, w: 170, h: 132, text: "Room for ideas", font: "hand", textSize: "s" } },
  { title: "Line", shape: { id: "line", type: "line", order: 1, color: "orange", size: "m", x: 30, y: 128, dx: 200, dy: -74, strokeStyle: "dashed" } },
  { title: "Arrow", shape: { id: "arrow", type: "arrow", order: 1, color: "green", size: "m", x: 35, y: 90, dx: 190, dy: 0, text: "Keep going", font: "hand", textSize: "s" } },
  { title: "Freehand", shape: { id: "draw", type: "draw", order: 1, color: "red", size: "m", x: 30, y: 40, w: 200, h: 95, points: [0, 60, 15, 38, 30, 12, 50, 0, 65, 18, 70, 60, 90, 90, 115, 65, 135, 28, 160, 18, 180, 38, 200, 65] } },
  { title: "Text", shape: { id: "text", type: "text", order: 1, color: "black", size: "m", x: 32, y: 57, w: 205, h: 80, text: "Make space\nfor your next idea.", font: "hand", fontSize: 28 } },
]

export function ShapeGallery() {
  const [fadeOut, setFadeOut] = useState(false)
  const [hideLabel, setHideLabel] = useState(false)
  return (
    <div>
      <fieldset className="example-options">
        <legend>Renderer props</legend>
        <label><input type="checkbox" checked={fadeOut} onChange={(event) => setFadeOut(event.target.checked)} /> fadeOut</label>
        <label><input type="checkbox" checked={hideLabel} onChange={(event) => setHideLabel(event.target.checked)} /> hideLabel</label>
      </fieldset>
      <div className="shape-gallery">
        {samples.map(({ title, shape }) => (
          <figure key={shape.id}>
            <svg viewBox="0 0 260 180" role="img" aria-label={`${title} shape preview`}><ShapeView shape={shape} fadeOut={fadeOut} hideLabel={hideLabel} /></svg>
            <figcaption><span>{title}</span><code>{shape.type}</code></figcaption>
          </figure>
        ))}
      </div>
      <p className="example-footnote">ShapeView renders inside your own SVG. It needs no provider or store. The hideLabel prop leaves standalone text visible.</p>
    </div>
  )
}
