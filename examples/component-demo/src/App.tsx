import { useEffect, useState } from "react"
import type { ComponentType } from "react"
import { CompleteBoard } from "./examples/CompleteBoard"
import { ComposedBoard } from "./examples/ComposedBoard"
import { CustomControls } from "./examples/CustomControls"
import { MultipleBoards } from "./examples/MultipleBoards"
import { ShapeGallery } from "./examples/ShapeGallery"
import { PresenceExample } from "./examples/PresenceExample"
import { apiReference } from "./reference"
import completeSource from "./examples/CompleteBoard.tsx?raw"
import composedSource from "./examples/ComposedBoard.tsx?raw"
import customSource from "./examples/CustomControls.tsx?raw"
import multipleSource from "./examples/MultipleBoards.tsx?raw"
import shapesSource from "./examples/ShapeGallery.tsx?raw"
import presenceSource from "./examples/PresenceExample.tsx?raw"
import helpersSource from "./shared.tsx?raw"
import adapterSource from "./presence.ts?raw"
import componentGuide from "../../../packages/react/docs/components.md?raw"

type IconName = "board" | "layers" | "sliders" | "grid" | "shapes" | "people" | "book" | "code" | "copy" | "arrow" | "search"
const paths: Record<IconName, string> = {
  board: "M4 4h16v13H4z M8 21l4-4 4 4 M8 8l3 3 5-4",
  layers: "M3 8l9-5 9 5-9 5z M3 12l9 5 9-5 M3 16l9 5 9-5",
  sliders: "M4 6h6m4 0h6 M4 12h10m4 0h2 M4 18h2m4 0h10 M10 3v6 M14 9v6 M6 15v6",
  grid: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
  shapes: "M3 3h8v8H3z M17 3l5 8H12z M10 18a4 4 0 1 1-8 0 4 4 0 0 1 8 0 M14 14h7v7h-7z",
  people: "M9 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6 M3 21v-3a6 6 0 0 1 12 0v3 M17 4a3 3 0 0 1 0 6 M18 14a5 5 0 0 1 3 4v3",
  book: "M12 5v16 M12 5C8 2 4 3 2 4v15c3-1 6-1 10 2 4-3 7-3 10-2V4c-2-1-6-2-10 1",
  code: "M8 5l-6 7 6 7 M16 5l6 7-6 7 M14 3l-4 18",
  copy: "M8 8h13v13H8z M16 8V3H3v13h5",
  arrow: "M5 12h14 M13 6l6 6-6 6",
  search: "M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0 M15 15l6 6",
}

function Icon({ name }: { name: IconName }) {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>
}

interface Demo {
  id: string
  label: string
  title: string
  description: string
  exercise: string
  icon: IconName
  tags: Array<string>
  filename: string
  source: string
  component: ComponentType
}

const demos: Array<Demo> = [
  { id: "complete", label: "Complete board", title: "Start with a complete board.", description: "A canvas, drawing tools, styling, and zoom. Supply a core store and a container with a height, and your board is ready to embed.", exercise: "Drag a shape, double-click its label, or draw something new. Resize the bottom edge to see the canvas follow its container.", icon: "board", tags: ["Board", "useBoardStore", "useShapes", "useBoardName", "useCanUndoRedo"], filename: "CompleteBoard.tsx", source: completeSource, component: CompleteBoard },
  { id: "compose", label: "Compose an editor", title: "Pick the pieces you need.", description: "The provider holds editor state. The root defines the drawing area. Add the canvas and whichever controls belong in your application.", exercise: "Toggle individual controls. Select a shape to reveal the style panel. The canvas keeps its state as controls appear and disappear.", icon: "layers", tags: ["BoardProvider", "BoardRoot", "BoardCanvas", "BoardToolbar", "BoardStylePanel", "BoardZoomControls"], filename: "ComposedBoard.tsx", source: composedSource, component: ComposedBoard },
  { id: "custom", label: "Custom controls", title: "Make the editor your own.", description: "Build ordinary React buttons with useBoardEditor. Controls and inspectors can sit beside the canvas while sharing the same provider.", exercise: "Select a shape, change its color in the inspector, then duplicate it. The live inspector follows the selection, tool, and zoom.", icon: "sliders", tags: ["useBoardEditor", "useCanUndoRedo", "BoardProvider"], filename: "CustomControls.tsx", source: customSource, component: CustomControls },
  { id: "multiple", label: "Multiple boards", title: "Give each canvas its own space.", description: "Independent documents, tools, selections, and undo histories. Keyboard shortcuts stay with the focused board and leave your application's form fields alone.", exercise: "Edit the first canvas, then switch to the second. Try an undo in each. The text field below belongs to the host application.", icon: "grid", tags: ["Board", "useBoardStore"], filename: "MultipleBoards.tsx", source: multipleSource, component: MultipleBoards },
  { id: "shapes", label: "Shape rendering", title: "Render without an editor.", description: "Use ShapeView inside your own SVG to make previews, thumbnails, or a read-only drawing. No store or provider is required.", exercise: "Toggle the renderer props. Labels on shapes can be hidden independently of standalone text, and fading changes the whole shape's opacity.", icon: "shapes", tags: ["ShapeView", "Shape"], filename: "ShapeGallery.tsx", source: shapesSource, component: ShapeGallery },
  { id: "presence", label: "Peer presence", title: "Show who is working alongside you.", description: "The presence interface is independent of the transport. This example forwards cursor and selection updates between two local editors.", exercise: "Move your cursor or select a shape in either view. The other view shows its peer's cursor and selection. Shape edits appear in both views.", icon: "people", tags: ["Board", "BoardPresence", "usePeers"], filename: "PresenceExample.tsx", source: presenceSource, component: PresenceExample },
]

function currentPage() {
  const hash = window.location.hash.slice(1)
  return hash === "reference" || demos.some((demo) => demo.id === hash) ? hash : "complete"
}

function CopyButton({ text }: { text: string }) {
  const [status, setStatus] = useState("")
  const copy = async () => {
    try {
      if (!navigator.clipboard) throw new Error("Clipboard unavailable")
      await navigator.clipboard.writeText(text)
      setStatus("Copied")
    } catch {
      setStatus("Select the code to copy it")
    }
  }
  return <div className="copy-control"><button type="button" className="copy-button" onClick={() => void copy()}><Icon name="copy" />Copy</button><span role="status">{status}</span></div>
}

function CodeBlock({ filename, source }: { filename: string; source: string }) {
  return <div className="code-block"><div className="code-heading"><span><Icon name="code" />{filename}</span><CopyButton text={source} /></div><pre tabIndex={0} aria-label={`${filename} source code`}><code>{source}</code></pre></div>
}

function DemoContent({ demo }: { demo: Demo }) {
  const [sourceVisible, setSourceVisible] = useState(false)
  const Example = demo.component
  return (
    <>
      <div className="page-heading">
        <div className="eyebrow"><span>LIVE EXAMPLE</span><span className="eyebrow-line" />@kritzlboard/react</div>
        <h1>{demo.title}</h1>
        <p>{demo.description}</p>
        <div className="api-tags">{demo.tags.map((tag) => <code key={tag}>{tag}</code>)}</div>
      </div>
      <section className="example-panel" aria-label={`${demo.label} demonstration`}>
        <div className="panel-heading">
          <div className="view-switch" aria-label="Example view">
            <button type="button" aria-pressed={!sourceVisible} onClick={() => setSourceVisible(false)}><Icon name={demo.icon} />Preview</button>
            <button type="button" aria-pressed={sourceVisible} onClick={() => setSourceVisible(true)}><Icon name="code" />Source</button>
          </div>
          <span className="local-badge"><span className="status-dot" />No backend needed</span>
        </div>
        <div hidden={sourceVisible} className="demo-preview"><Example /></div>
        {sourceVisible && <div className="example-source"><CodeBlock filename={`examples/${demo.filename}`} source={demo.source} />
          {demo.id !== "shapes" && <details className="source-dependency"><summary>Shared store setup and document controls</summary><CodeBlock filename="shared.tsx" source={helpersSource} /></details>}
          {demo.id === "presence" && <details className="source-dependency"><summary>Local presence adapter</summary><CodeBlock filename="presence.ts" source={adapterSource} /></details>}
        </div>}
      </section>
      <div className="try-note"><span className="try-label">TRY THIS</span><p>{demo.exercise}</p></div>
      <div className="next-links"><span>Each example imports the public package exports.</span><a href="#reference">Explore the API <Icon name="arrow" /></a></div>
    </>
  )
}

function ReferencePage() {
  const [query, setQuery] = useState("")
  const search = query.trim().toLowerCase()
  const entries = apiReference.filter((entry) => `${entry.name} ${entry.kind} ${entry.summary}`.toLowerCase().includes(search))
  return (
    <>
      <div className="page-heading"><div className="eyebrow"><span>API REFERENCE</span><span className="eyebrow-line" />@kritzlboard/react</div><h1>The pieces, explained.</h1><p>Every exported component, hook, and editor type. Start with Board, or assemble the editor around your own application.</p></div>
      <div className="reference-toolbar">
        <label className="reference-search"><Icon name="search" /><span className="sr-only">Search the API reference</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find a component, hook, or type…" /></label>
        <a className="pg-button" href={`data:text/markdown;charset=utf-8,${encodeURIComponent(componentGuide)}`} download="kritzlboard-react-components.md"><Icon name="book" />Download guide</a>
      </div>
      <p className="result-count" role="status">{entries.length} of {apiReference.length} API entries</p>
      <div className="reference-list">
        {entries.map((entry) => <details className="reference-entry" key={entry.id} open={entries.length === 1}>
          <summary><span className={`kind-badge kind-${entry.kind}`}>{entry.kind}</span><span><strong>{entry.name}</strong><span className="entry-summary">{entry.summary}</span></span><span className="disclosure-plus" aria-hidden="true">+</span></summary>
          <div className="reference-body"><pre className="signature"><code>{entry.signature}</code></pre>
            {entry.props && entry.props.length > 0 && <div className="table-scroll"><table><caption>Props for {entry.name}</caption><thead><tr><th scope="col">Prop</th><th scope="col">Type</th><th scope="col">Default</th><th scope="col">Behavior</th></tr></thead><tbody>{entry.props.map((prop) => <tr key={prop.name}><td><code>{prop.name}</code></td><td><code>{prop.type}</code></td><td><code>{prop.defaultValue}</code></td><td>{prop.description}</td></tr>)}</tbody></table></div>}
            <ul className="reference-notes">{entry.details.map((detail) => <li key={detail}>{detail}</li>)}</ul>
            <CodeBlock filename={`${entry.name} usage`} source={entry.usage} />
          </div>
        </details>)}
        {entries.length === 0 && <div className="empty-results"><Icon name="search" /><h2>No matching API entries</h2><p>Try “Board”, “selection”, or “hook”.</p><button type="button" className="pg-button" onClick={() => setQuery("")}>Clear search</button></div>}
      </div>
    </>
  )
}

export function App() {
  const [page, setPage] = useState(currentPage)
  useEffect(() => {
    const navigate = () => setPage(currentPage())
    window.addEventListener("hashchange", navigate)
    return () => window.removeEventListener("hashchange", navigate)
  }, [])
  const demo = demos.find((item) => item.id === page) ?? demos[0]
  useEffect(() => {
    document.title = `${page === "reference" ? "API reference" : demo.label} · Kritzlboard`
  }, [page, demo.label])
  return (
    <div className="playground">
      <a className="skip-link" href="#main-content">Skip to content</a>
      <header className="topbar"><a className="brand" href="#complete" aria-label="Kritzlboard component playground"><span className="brand-mark"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M7 5 5 19M18 5 8 12l11 7M10 5 8 9" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" /></svg></span><span>kritzlboard<span className="brand-divider">/</span><span className="brand-subtitle">playground</span></span></a><span className="topbar-label"><span className="status-dot" />React components</span></header>
      <div className="app-frame">
        <aside className="sidebar">
          <div className="sidebar-heading">LEARN BY BUILDING</div>
          <nav aria-label="Component examples"><ul>{demos.map((item, index) => <li key={item.id}><a href={`#${item.id}`} aria-current={page === item.id ? "page" : undefined}><Icon name={item.icon} /><span>{item.label}</span><span className="nav-number">0{index + 1}</span></a></li>)}</ul></nav>
          <div className="sidebar-heading reference-heading">REFERENCE</div>
          <nav aria-label="Documentation"><ul><li><a href="#reference" aria-current={page === "reference" ? "page" : undefined}><Icon name="book" /><span>Components & hooks</span></a></li></ul></nav>
          <div className="sidebar-footer"><span className="sidebar-note-icon"><Icon name="layers" /></span><strong>Small pieces.<br />Your application.</strong><p>Core state, React rendering, and optional collaboration. Use what you need.</p><div className="package-stack"><code>@kritzlboard/core</code><code>@kritzlboard/react</code><code>@kritzlboard/sync</code></div></div>
        </aside>
        <main id="main-content" className="main-content" tabIndex={-1}>
          {page === "reference" ? <ReferencePage /> : <DemoContent key={demo.id} demo={demo} />}
          <footer className="page-footer"><span>Kritzlboard component playground</span><span>Local examples · React 19 · SVG canvas</span></footer>
        </main>
      </div>
    </div>
  )
}
