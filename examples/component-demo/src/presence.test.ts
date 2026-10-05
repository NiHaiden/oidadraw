import { describe, expect, it, vi } from "vitest"
import { createPresencePair } from "./presence"

describe("demo presence adapter", () => {
  it("publishes only to the other endpoint and caches unchanged snapshots", () => {
    const [alex, sam] = createPresencePair()
    const alexChanged = vi.fn()
    const samChanged = vi.fn()
    const originalAlexSnapshot = alex.getPeers()
    const originalSamSnapshot = sam.getPeers()
    alex.subscribe(alexChanged)
    const unsubscribe = sam.subscribe(samChanged)
    alex.setCursor({ x: 40, y: 50 })
    expect(sam.getPeers()).not.toBe(originalSamSnapshot)
    expect(sam.getPeers()[0]).toMatchObject({ user: { name: "Alex" }, cursor: { x: 40, y: 50 } })
    expect(alex.getPeers()).toBe(originalAlexSnapshot)
    expect(sam.getPeers()).toBe(sam.getPeers())
    expect(samChanged).toHaveBeenCalledTimes(1)
    expect(alexChanged).not.toHaveBeenCalled()
    unsubscribe()
    alex.setCursor(null)
    expect(sam.getPeers()[0].cursor).toBeNull()
    expect(samChanged).toHaveBeenCalledTimes(1)
  })

  it("copies outgoing selection and cursor values and isolates separate pairs", () => {
    const [alex, sam] = createPresencePair()
    const [unrelated] = createPresencePair()
    const selection = ["shape-1"]
    const cursor = { x: 12, y: 24 }
    alex.setSelectionPresence(selection)
    alex.setCursor(cursor)
    selection.push("shape-2")
    cursor.x = 100
    expect(sam.getPeers()[0]).toMatchObject({ selection: ["shape-1"], cursor: { x: 12, y: 24 } })
    expect(unrelated.getPeers()[0]).toMatchObject({ selection: [], cursor: null })
    alex.setSelectionPresence([])
    expect(sam.getPeers()[0].selection).toEqual([])
  })
})
