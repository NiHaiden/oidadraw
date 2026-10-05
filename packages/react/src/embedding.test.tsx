// @vitest-environment jsdom
import { StrictMode } from "react"
import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  within,
} from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { BoardStore } from "@kritzlboard/core"
import {
  Board,
  BoardCanvas,
  BoardProvider,
  BoardRoot,
  BoardToolbar,
  useBoardEditor,
  useBoardStore,
} from "./index.js"
import { measureTextBox } from "./measureText.js"
import type { PeerState, RectShape } from "@kritzlboard/core"
import type { BoardPresence } from "./types.js"

const square: RectShape = {
  id: "square",
  type: "rect",
  order: 1,
  color: "black",
  size: "m",
  fill: "none",
  x: 0,
  y: 0,
  w: 100,
  h: 100,
}
const stores: Array<BoardStore> = []
const observers: Array<{
  resize: () => void
  disconnect: ReturnType<typeof vi.fn>
}> = []
let bounds: DOMRect

function createStore() {
  const store = new BoardStore("same-board-id")
  store.putShape(square)
  stores.push(store)
  return store
}

function Inspector() {
  const editor = useBoardEditor()
  return (
    <>
      <output data-testid="tool">{editor.tool}</output>
      <output data-testid="camera">{JSON.stringify(editor.camera)}</output>
      <output data-testid="selection">{[...editor.selection].join(",")}</output>
      <output data-testid="color">{editor.style.color}</output>
      <button type="button" onClick={() => editor.setTool("draw")}>
        Custom pen
      </button>
      <button
        type="button"
        onClick={() => editor.changeStyle({ color: "green" })}
      >
        Custom color
      </button>
    </>
  )
}

beforeEach(() => {
  bounds = new DOMRect(100, 50, 600, 400)
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    () => bounds
  )
  vi.spyOn(SVGElement.prototype, "getBoundingClientRect").mockImplementation(
    () => bounds
  )
  vi.stubGlobal(
    "ResizeObserver",
    class {
      disconnect = vi.fn()
      constructor(callback: () => void) {
        observers.push({ resize: callback, disconnect: this.disconnect })
      }
      observe() {}
      unobserve() {}
    }
  )
})

afterEach(() => {
  cleanup()
  for (const store of stores.splice(0)) store.destroy()
  observers.splice(0)
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function canvas(root: HTMLElement) {
  const svg = root.querySelector<SVGSVGElement>(".kb-canvas")!
  svg.setPointerCapture = vi.fn()
  svg.hasPointerCapture = vi.fn(() => true)
  svg.releasePointerCapture = vi.fn()
  return svg
}

function camera(root: HTMLElement) {
  return JSON.parse(within(root).getByTestId("camera").textContent)
}

describe("embedding", () => {
  it("scopes shortcuts, clipboard, and preferences to each board and leaves host inputs alone", () => {
    const left = createStore()
    const right = createStore()
    const storage = { getItem: vi.fn(), setItem: vi.fn() }
    vi.stubGlobal("localStorage", storage)
    const view = render(
      <>
        <Board store={left} data-testid="left" initialStyle={{ color: "red" }}>
          <Inspector />
        </Board>
        <Board
          store={right}
          data-testid="right"
          initialStyle={{ color: "blue" }}
        >
          <Inspector />
        </Board>
        <input aria-label="Host field" />
      </>
    )
    const a = view.getByTestId("left")
    const b = view.getByTestId("right")
    a.focus()
    fireEvent.keyDown(a, { key: "r" })
    expect(within(a).getByTestId("tool").textContent).toBe("rect")
    expect(within(b).getByTestId("tool").textContent).toBe("select")
    fireEvent.keyDown(a, { key: "a", ctrlKey: true })
    fireEvent.keyDown(a, { key: "c", ctrlKey: true })
    b.focus()
    fireEvent.keyDown(b, { key: "v", ctrlKey: true })
    expect(right.getShapes()).toHaveLength(1)
    a.focus()
    fireEvent.keyDown(a, { key: "v", ctrlKey: true })
    expect(left.getShapes()).toHaveLength(2)
    fireEvent.click(within(a).getByText("Custom color"))
    expect(within(a).getByTestId("color").textContent).toBe("green")
    expect(within(b).getByTestId("color").textContent).toBe("blue")

    const input = view.getByLabelText("Host field")
    input.focus()
    fireEvent.keyDown(input, { key: "Delete" })
    fireEvent.keyDown(input, { key: "z", ctrlKey: true })
    fireEvent.keyDown(window, { key: "Delete" })
    expect(left.getShapes()).toHaveLength(2)
    expect(right.getShapes()).toHaveLength(1)
    expect(storage.getItem).not.toHaveBeenCalled()
    expect(storage.setItem).not.toHaveBeenCalled()
  })

  it("uses container dimensions for camera setup, resize and zoom reset, including Strict Mode", () => {
    const store = createStore()
    const view = render(
      <StrictMode>
        <Board store={store} data-testid="board">
          <Inspector />
        </Board>
      </StrictMode>
    )
    const root = view.getByTestId("board")
    canvas(root)
    expect(camera(root)).toEqual({ x: -300, y: -200, z: 1 })
    root.focus()
    fireEvent.keyDown(root, { key: "+", ctrlKey: true })
    expect(camera(root)).toEqual({ x: -240, y: -160, z: 1.25 })
    bounds = new DOMRect(100, 50, 800, 500)
    act(() => observers.at(-1)!.resize())
    expect(camera(root)).toEqual({ x: -320, y: -200, z: 1.25 })
    fireEvent.click(within(root).getByTitle("Reset zoom (Ctrl+0)"))
    expect(camera(root)).toEqual({ x: -400, y: -250, z: 1 })
    view.unmount()
    for (const observer of observers)
      expect(observer.disconnect).toHaveBeenCalledTimes(1)
    expect(store.doc.isDestroyed).toBe(false)
  })

  it("composes a custom toolbar and never submits a surrounding form", () => {
    const store = createStore()
    const submit = vi.fn((event) => event.preventDefault())
    const view = render(
      <form onSubmit={submit}>
        <BoardProvider store={store}>
          <BoardRoot data-testid="board">
            <BoardCanvas />
            <BoardToolbar />
            <Inspector />
          </BoardRoot>
        </BoardProvider>
      </form>
    )
    const root = view.getByTestId("board")
    fireEvent.click(within(root).getByText("Custom pen"))
    expect(within(root).getByTestId("tool").textContent).toBe("draw")
    fireEvent.click(within(root).getByTitle("Rectangle (R)"))
    expect(within(root).getByTestId("tool").textContent).toBe("rect")
    expect(root.querySelector(".kb-style-panel")).toBeNull()
    expect(root.querySelector(".kb-zoom")).toBeNull()
    expect(submit).not.toHaveBeenCalled()
  })

  it("resets temporary panning when focus leaves the board or browser", () => {
    const view = render(
      <>
        <Board store={createStore()} data-testid="board" />
        <input aria-label="Outside" />
      </>
    )
    const root = view.getByTestId("board")
    root.focus()
    fireEvent.keyDown(root, { key: " " })
    expect(root.dataset.cursor).toBe("grab")
    act(() => view.getByLabelText("Outside").focus())
    expect(root.dataset.cursor).toBe("default")
    root.focus()
    fireEvent.keyDown(root, { key: " " })
    fireEvent.blur(window)
    expect(root.dataset.cursor).toBe("default")
  })

  it("ignores shapes in other boards during DOM hit testing, even with identical IDs", () => {
    const first = createStore()
    const second = createStore()
    const view = render(
      <>
        <Board store={first} data-testid="a" />
        <Board store={second} data-testid="b" />
      </>
    )
    const root = view.getByTestId("a")
    const svg = canvas(root)
    const foreign = view.getByTestId("b").querySelector("[data-shape-id]")!
    Object.defineProperty(document, "elementsFromPoint", {
      configurable: true,
      value: () => [foreign],
    })
    try {
      root.focus()
      fireEvent.keyDown(root, { key: "e" })
      fireEvent.pointerDown(svg, {
        pointerId: 1,
        button: 0,
        clientX: 450,
        clientY: 300,
      })
      fireEvent.pointerUp(svg, {
        pointerId: 1,
        button: 0,
        clientX: 450,
        clientY: 300,
      })
      expect(first.getShapes()).toHaveLength(1)
      expect(second.getShapes()).toHaveLength(1)
    } finally {
      Reflect.deleteProperty(document, "elementsFromPoint")
    }
  })

  it("resets view state when the supplied store changes without destroying either store", () => {
    const first = createStore()
    const second = createStore()
    const view = render(
      <Board store={first} data-testid="board">
        <Inspector />
      </Board>
    )
    let root = view.getByTestId("board")
    root.focus()
    fireEvent.keyDown(root, { key: "a", ctrlKey: true })
    fireEvent.keyDown(root, { key: "r" })
    view.rerender(
      <Board store={second} data-testid="board">
        <Inspector />
      </Board>
    )
    root = view.getByTestId("board")
    expect(within(root).getByTestId("tool").textContent).toBe("select")
    expect(within(root).getByTestId("selection").textContent).toBe("")
    expect(first.doc.isDestroyed).toBe(false)
    view.unmount()
    expect(second.doc.isDestroyed).toBe(false)
  })

  it("subscribes to optional presence and clears local presence on unmount", () => {
    const store = createStore()
    const listeners = new Set<() => void>()
    let peers: Array<PeerState> = []
    const presence: BoardPresence = {
      subscribe: (listener) => {
        listeners.add(listener)
        return () => {
          listeners.delete(listener)
        }
      },
      getPeers: () => peers,
      setCursor: vi.fn(),
      setSelectionPresence: vi.fn(),
    }
    const view = render(
      <Board store={store} presence={presence} data-testid="board" />
    )
    const root = view.getByTestId("board")
    const svg = canvas(root)
    fireEvent.pointerMove(svg, { clientX: 400, clientY: 250 })
    expect(presence.setCursor).toHaveBeenLastCalledWith({ x: 0, y: 0 })
    root.focus()
    fireEvent.keyDown(root, { key: "a", ctrlKey: true })
    expect(presence.setSelectionPresence).toHaveBeenLastCalledWith(["square"])
    act(() => {
      peers = [
        {
          clientId: 42,
          user: { name: "Other person", color: "red" },
          cursor: { x: 10, y: 20 },
          selection: ["square"],
        },
      ]
      for (const listener of listeners) listener()
    })
    expect(within(root).getByText("Other person")).toBeDefined()
    view.unmount()
    expect(presence.setCursor).toHaveBeenLastCalledWith(null)
    expect(presence.setSelectionPresence).toHaveBeenLastCalledWith([])
    expect(listeners.size).toBe(0)
    expect(store.doc.isDestroyed).toBe(false)
  })

  it("manages hook-created stores across Strict Mode, ID changes, and unmount", () => {
    const hook = renderHook(({ id }) => useBoardStore(id), {
      initialProps: { id: "first" },
      wrapper: StrictMode,
    })
    const first = hook.result.current!
    expect(first.doc.isDestroyed).toBe(false)
    hook.rerender({ id: "second" })
    const second = hook.result.current!
    expect(first.doc.isDestroyed).toBe(true)
    expect(second.boardId).toBe("second")
    expect(second.doc.isDestroyed).toBe(false)
    hook.unmount()
    expect(second.doc.isDestroyed).toBe(true)
  })

  it("measures text inside its own styled root and removes the probe", () => {
    const root = document.createElement("div")
    root.style.setProperty("--kb-font-sans", "monospace")
    document.body.appendChild(root)
    let parent: HTMLElement | null = null
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
      function (this: HTMLElement) {
        if (this.className === "kb-text") parent = this.parentElement
        return bounds
      }
    )
    try {
      measureTextBox(root, "Hello", 24, "sans")
      expect(parent).toBe(root)
      expect(root.children.length).toBe(0)
    } finally {
      root.remove()
    }
  })
})
