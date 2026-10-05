// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { ComposedBoard } from "./examples/ComposedBoard"
import { CustomControls } from "./examples/CustomControls"

afterEach(cleanup)

describe("component examples", () => {
  it("can hide and restore the toolbar without replacing the board", async () => {
    render(<ComposedBoard />)

    const board = await screen.findByRole("region")
    expect(await screen.findByTitle("Select (V)")).toBeTruthy()

    fireEvent.click(screen.getByRole("checkbox", { name: /toolbar/i }))
    expect(screen.queryByTitle("Select (V)")).toBeNull()
    expect(screen.getByRole("region")).toBe(board)
    expect(screen.getByText("Your idea")).toBeTruthy()

    fireEvent.click(screen.getByRole("checkbox", { name: /toolbar/i }))
    expect(screen.getByTitle("Select (V)")).toBeTruthy()
    expect(screen.getByRole("region")).toBe(board)
  })

  it("lets host-owned controls select and duplicate the board content", async () => {
    render(<CustomControls />)

    await screen.findByText("Your idea")
    const duplicate = screen.getByRole<HTMLButtonElement>("button", {
      name: /^duplicate$/i,
    })
    expect(duplicate.disabled).toBe(true)

    fireEvent.click(screen.getByRole("button", { name: /^select all$/i }))
    expect(duplicate.disabled).toBe(false)
    fireEvent.click(duplicate)

    expect(screen.getAllByText("Your idea")).toHaveLength(2)
    expect(screen.getAllByText("What's next?")).toHaveLength(2)
  })
})

