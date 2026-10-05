# Kritzlboard component playground

A standalone React application demonstrating the public `@kritzlboard/react` API. It uses workspace packages and the repository's existing dependencies. It runs without the application server, authentication, or database.

## Run locally

From the repository root, with Node.js 23.6 or newer and pnpm installed:

```sh
pnpm install
pnpm build:packages
pnpm exec vite --config examples/component-demo/vite.config.ts
```

Open **http://127.0.0.1:3002**. The playground has its own Vite configuration and does not start the main application.

To rebuild package source automatically, run the relevant package watchers in additional terminals:

```sh
pnpm --filter @kritzlboard/core dev
pnpm --filter @kritzlboard/react dev
```

The demo reloads when package output changes. Without watchers, run `pnpm build:packages` after changing a package.

## Build and preview

```sh
pnpm build:packages
pnpm exec vite build --config examples/component-demo/vite.config.ts
pnpm exec vite preview --config examples/component-demo/vite.config.ts
```

The static output is written to `examples/component-demo/dist/`. Relative asset paths and hash navigation allow the build to be hosted under a subdirectory.

## Examples

Every example includes its actual source file and any shared helpers it uses. Switching between Preview and Source preserves that example's board state. Switching examples or reloading starts a new in-memory document.

| Example | What it demonstrates |
| --- | --- |
| Complete board | `Board`, `useBoardStore`, initial styles, document metadata, undo/redo, and a resizable container |
| Compose controls | `BoardProvider`, `BoardRoot`, `BoardCanvas`, `BoardToolbar`, `BoardStylePanel`, and `BoardZoomControls`; toggle controls while keeping the same document |
| Custom controls | `useBoardEditor`, host-owned tool buttons, selection actions, colors, camera controls, and a live selection inspector |
| Independent boards | Two stores with independent documents, controls, history, and keyboard focus |
| Shape gallery | `ShapeView` inside ordinary SVG elements, with `fadeOut` and `hideLabel` options |
| Local presence | `BoardPresence`, `usePeers`, and two editors sharing a document while displaying each other's cursor and selection |
| API reference | Searchable documentation for every public React component, hook, and type, with signatures, defaults, and usage examples |

The presence example is deliberately in-memory: both editors share one `BoardStore`. The views also share undo history. It demonstrates the presence interface, not a network transport. For remote clients, use separate stores and connect them with `@kritzlboard/sync`.

## Embed a board in your application

```tsx
import { Board, useBoardStore } from "@kritzlboard/react"
import "@kritzlboard/react/styles.css"

export function DrawingArea() {
  const store = useBoardStore("my-document")
  if (!store) return <p>Preparing board…</p>

  return (
    <div style={{ height: 500 }}>
      <Board store={store} aria-label="Project sketch" />
    </div>
  )
}
```

The container must have a definite height. `useBoardStore` creates the document after mounting and destroys it when its owner unmounts; the ID is a label, not a persistence or synchronization mechanism. Keep the hook's owner mounted to retain the document. Import the package stylesheet once in the host application.

Controls placed outside `BoardRoot` can call editor actions, but keyboard shortcuts require focus within the board. Click the canvas after using an external control to restore that focus.

The playground imports Inter and Caveat from the repository's existing font dependencies. Fonts are optional; hosts can configure `--kb-font-sans` and `--kb-font-hand`.

## Documentation

- [Complete React component, hook, and type reference](../../packages/react/docs/components.md)
- [React package overview](../../packages/react/README.md)
- [Core package](../../packages/core/README.md)
- [Optional synchronization](../../packages/sync/README.md)

The playground's API reference includes a downloadable copy of the Markdown reference. Documentation covers composition, lifecycle, SSR, styling, presence snapshots, and current integration limitations.

## Structure

- `src/examples/`: one component per runnable example.
- `src/shared.tsx`: seed document, lifecycle helper, and reactive document footer.
- `src/presence.ts`: small local presence adapter.
- `src/reference.ts`: searchable API entries.
- `src/App.tsx`: navigation, source viewer, and reference UI.
- `vite.config.ts`: isolated development server and static build.

## Checks

From the repository root:

```sh
pnpm typecheck
pnpm exec vitest run examples/component-demo/src
pnpm exec eslint examples/component-demo
pnpm exec vite build --config examples/component-demo/vite.config.ts
```

Tests exercise custom controls, composition, and presence subscriptions. The existing package tests cover drawing behavior; this demo does not duplicate that suite.

This application keeps drawings only in memory. Refreshing the page clears them.

