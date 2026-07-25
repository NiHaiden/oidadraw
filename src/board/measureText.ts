import { FONT_STYLES } from "./types"
import type { FontId } from "./types"

let probe: HTMLDivElement | null = null

function getProbe(): HTMLDivElement {
  if (probe) return probe
  probe = document.createElement("div")
  // same typography rules the shape is rendered with; max-content mirrors the
  // editor, which is free to grow and only breaks on typed newlines
  probe.className = "shape-text-content"
  probe.style.position = "absolute"
  probe.style.left = "-9999px"
  probe.style.top = "0"
  probe.style.width = "max-content"
  probe.style.visibility = "hidden"
  probe.style.pointerEvents = "none"
  document.body.appendChild(probe)
  return probe
}

/**
 * Size a text shape's box off-screen. The editor normally measures its own live
 * DOM on commit, so this is only for changes made without opening it — e.g.
 * switching the font, whose metrics differ enough to change the wrap width.
 */
export function measureTextBox(
  text: string,
  fontSize: number,
  font: FontId
): { w: number; h: number } {
  const el = getProbe()
  const { fontFamily, fontWeight } = FONT_STYLES[font]
  el.style.fontFamily = fontFamily
  el.style.fontWeight = String(fontWeight)
  el.style.fontSize = `${fontSize}px`
  el.textContent = text
  const rect = el.getBoundingClientRect()
  return {
    w: Math.max(rect.width, 8),
    h: Math.max(rect.height, fontSize * 1.35),
  }
}
