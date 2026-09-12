# @kritzlboard/react

Embeddable SVG whiteboard, React hooks, and composable editing controls built on
`@kritzlboard/core`. The package includes drawing, selection, resizing, labels,
connector editing, camera controls, keyboard shortcuts, and optional peer cursors.
It has no router, authentication, storage, WebSocket, or Tailwind dependency.

## Embed a local board

The workspace package currently targets React 19.2.6 or later within React 19.
It exports compiled ESM, TypeScript declarations, and a separate stylesheet.
It has not been published to a registry.

```tsx
import { Board, useBoardStore } from "@kritzlboard/react"
import "@kritzlboard/react/styles.css"

export function DrawingCard() {
  const store = useBoardStore("drawing-card")
  return (
    <div style={{ height: 480 }}>
      {store && <Board store={store} aria-label="Project sketch" />}
    </div>
  )
}
```

Give the parent a definite height. The board fills its container and observes
container resizing. Each instance has its own camera, tool, selection, style,
and internal clipboard. Keyboard shortcuts apply within the focused board and
leave text inputs alone. Click the canvas or Tab into the board to focus it.

`useBoardStore` returns `null` until mounted. It creates a local core store and
destroys it on unmount or when the ID changes, including in React Strict Mode.
IDs label documents; two hook calls with the same ID still create independent
documents. Local boards are in memory until the host adds persistence.

You can instead supply an existing `BoardStore` from `@kritzlboard/core`.
`Board` and `BoardProvider` never destroy a supplied store or its transport.
Replacing the store starts a fresh editor session. Use the core store's document
and mutation APIs to load, save, or update content.

## Compose controls

Set `controls={false}` on `Board` and pass custom controls as children, or compose
one `BoardRoot` and one `BoardCanvas` inside a `BoardProvider`:

```tsx
import {
  BoardProvider,
  BoardRoot,
  BoardCanvas,
  BoardStylePanel,
  BoardZoomControls,
  useBoardEditor,
} from "@kritzlboard/react"
import type { BoardStore } from "@kritzlboard/core"

function MyTools() {
  const editor = useBoardEditor()
  return (
    <div style={{ position: "absolute", top: 12, left: 12 }}>
      <button type="button" onClick={() => editor.setTool("draw")}>
        Pen
      </button>
      <button type="button" onClick={() => editor.setTool("select")}>
        Select
      </button>
      <button type="button" onClick={() => editor.deleteSelection()}>
        Delete
      </button>
    </div>
  )
}

export function CustomBoard({ store }: { store: BoardStore }) {
  return (
    <BoardProvider store={store}>
      <BoardRoot style={{ height: 480 }}>
        <BoardCanvas />
        <MyTools />
        <BoardStylePanel />
        <BoardZoomControls />
      </BoardRoot>
    </BoardProvider>
  )
}
```

`BoardToolbar` supplies the default tool picker and undo/redo buttons.
`useBoardEditor()` exposes camera, tool, selection, selected shapes, style, and
commands for tools, selection, styling, deletion, duplication, and zoom.
Undo and redo are available on `editor.store`.

The standalone subscription hooks are `useShapes(store)`, `useBoardName(store)`,
`useCanUndoRedo(store)`, and `usePeers(presence)`. `ShapeView` is exported for
rendering individual shapes inside an SVG. See the exported TypeScript types for
the complete API.

## Collaboration and preferences

Use [`@kritzlboard/sync`](../sync/README.md) to connect the supplied core store,
or attach another transport to its `doc` to synchronize content.
Peer cursors and selections are optional and supplied separately through the
`presence` prop, which implements `BoardPresence`:

- `subscribe(listener)` returns an unsubscribe function.
- `getPeers()` returns a cached `PeerState[]` snapshot until presence changes.
- `setCursor(cursor)` publishes a world coordinate or `null`.
- `setSelectionPresence(ids)` publishes the selected shape IDs.

Pass stable, bound functions. The editor clears its cursor and selection when it
unmounts; the host remains responsible for closing the transport. Pass a sync
package `BoardConnection` directly as `presence`, as the existing application does.

`initialStyle` sets drawing defaults when an editor session starts.
`onStyleChange(style)` lets the host persist preferences; the package itself does
not access localStorage. Changes to `initialStyle` after mount do not overwrite
editing state; use `editor.changeStyle(patch)` for live updates.

## Styling and server rendering

Import `@kritzlboard/react/styles.css` once in your application. Its selectors
use the `kb-` prefix and do not reset the host page. Customize a board through
CSS variables on its root or parent:

```css
.drawing-card {
  --kb-background: #f8fafc;
  --kb-panel-background: #fff;
  --kb-border: #cbd5e1;
  --kb-accent: #7c3aed;
  --kb-font-sans: system-ui, sans-serif;
  --kb-font-hand: "Caveat Variable", cursive;
}
```

Fonts are supplied by the host. Defaults use Inter Variable and Caveat Variable
when available, with system fallbacks. The standalone example loads those fonts
to match the existing application.

The package can be imported and server-rendered without browser globals. In
React Server Component applications, put the hook/store setup in a client
component. A live `BoardStore` should not be serialized across a server/client
boundary. The hook example renders an empty container on the server and creates
its document on the client.

## Development

From the repository root:

```sh
pnpm build:packages
pnpm --filter @kritzlboard/react test
pnpm --filter @kritzlboard/react typecheck
pnpm dev:web
```

Open `http://localhost:3000/examples/react-embedding/` for two local boards,
custom controls, resizable containers, and a host text field. No backend is
needed for this example. Root build, test, and typecheck commands build the
packages first. `dev:web` watches the workspace packages and the application.
Compiled package changes reload the page after the build writes settle, so local
in-memory example documents reset during package development.
