import type { FontId } from "@kritzlboard/core"

export const FONT_STYLES: Record<
  FontId,
  { fontFamily: string; fontWeight: number }
> = {
  sans: {
    fontFamily: 'var(--kb-font-sans, "Inter Variable", sans-serif)',
    fontWeight: 400,
  },
  hand: {
    fontFamily:
      'var(--kb-font-hand, "Caveat Variable", "Comic Sans MS", cursive)',
    fontWeight: 600,
  },
}
