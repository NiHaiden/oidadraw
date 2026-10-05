import { afterEach, describe, expect, it, vi } from "vitest"
import { BoardStore as CoreBoardStore } from "@kritzlboard/core"
import { BoardStore } from "./store"
import type { BoardStore as LocalStore } from "@kritzlboard/core"

const created = vi.hoisted(() => vi.fn())
vi.mock("@/lib/user", () => ({
  getUser: () => ({ name: "Test", color: "blue" }),
}))
vi.mock("@kritzlboard/sync", () => ({
  BoardConnection: class {
    store: LocalStore
    constructor(options: { store: LocalStore }) {
      this.store = options.store
      created(options)
    }
    destroy = vi.fn(() => expect(this.store.doc.isDestroyed).toBe(false))
  },
}))
const stores: Array<BoardStore> = []
function createStore() {
  const store = new BoardStore("test-board")
  stores.push(store)
  return store
}
afterEach(() => {
  for (const store of stores.splice(0)) {
    if (!store.doc.isDestroyed) store.destroy()
  }
  vi.clearAllMocks()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe("application BoardStore adapter", () => {
  it("composes core and sync using the app origin and current identity", () => {
    vi.stubEnv("VITE_SYNC_URL", "")
    vi.stubGlobal("location", { protocol: "https:", host: "boards.example" })
    const store = createStore()
    expect(store).toBeInstanceOf(CoreBoardStore)
    expect(created).toHaveBeenCalledWith({
      store,
      url: "wss://boards.example/sync",
      user: { name: "Test", color: "blue" },
    })
    store.destroy()
    expect(store.connection.destroy).toHaveBeenCalledTimes(1)
    expect(store.doc.isDestroyed).toBe(true)
  })
  it("keeps the environment URL override in the application", () => {
    vi.stubEnv("VITE_SYNC_URL", "wss://external.example/collaboration")
    const store = createStore()
    expect(created).toHaveBeenCalledWith(
      expect.objectContaining({
        store,
        url: "wss://external.example/collaboration",
      })
    )
  })
})
