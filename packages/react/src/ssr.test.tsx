// @vitest-environment node
import { renderToString } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { BoardStore } from "@kritzlboard/core"
import { Board } from "./index.js"

describe("server rendering", () => {
  it("renders without browser globals or opening a connection", () => {
    const store = new BoardStore("ssr")
    try {
      const html = renderToString(<Board store={store} />)
      expect(html).toContain('class="kb-canvas"')
      expect(html).toContain('aria-label="Drawing board"')
      expect(store.doc.isDestroyed).toBe(false)
    } finally {
      store.destroy()
    }
  })
})
