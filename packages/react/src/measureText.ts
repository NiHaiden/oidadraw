import { FONT_STYLES } from "./typography.js"
import type { FontId } from "@kritzlboard/core"

/** Measure with this board's typography, then immediately release the DOM probe. */
export function measureTextBox(
  root: HTMLElement,
  text: string,
  fontSize: number,
  font: FontId
): { w: number; h: number } {
  const probe = root.ownerDocument.createElement("div")
  probe.className = "kb-text"
  Object.assign(probe.style, FONT_STYLES[font], {
    position: "absolute",
    left: "-9999px",
    top: "0",
    width: "max-content",
    visibility: "hidden",
    pointerEvents: "none",
    fontSize: `${fontSize}px`,
  })
  probe.textContent = text
  root.appendChild(probe)
  try {
    const rect = probe.getBoundingClientRect()
    return {
      w: Math.max(rect.width, 8),
      h: Math.max(rect.height, fontSize * 1.35),
    }
  } finally {
    probe.remove()
  }
}
