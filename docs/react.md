# React integration and rendering code

Use `@kritzlboard/react` to embed the board in another React application. It
depends on the core document model and accepts optional presence, while routing,
accounts, networking, and persistence remain host concerns.

The [complete component reference](../packages/react/docs/components.md) documents
every public component and prop. This guide explains how to integrate the
components and navigate their implementation. See the [hook reference](hooks.md)
for subscription and lifecycle contracts and the
[component demo](../examples/component-demo/README.md) for working examples.

## Choose the right entry point

| Need | Entry point |
| --- | --- |
| An editor with the default controls | `Board` from `@kritzlboard/react` |
| Custom tools, controls, or layout | `BoardProvider`, `BoardRoot`, `BoardCanvas`, and selected controls |
| A single shape or static SVG preview | `ShapeView` |
| A local document tied to a component | `useBoardStore` |
| A document owned elsewhere in the host | Supply a core `BoardStore` |
| Remote collaboration | Attach `BoardConnection` from `@kritzlboard/sync`; pass it as `presence` |
| The existing full product | Application wrapper in [src/board/Board.tsx](../src/board/Board.tsx) |

The reusable package and the application's `Board` have different jobs. The
application wrapper adds the top bar and browser preference persistence, takes
the application-specific store, and fills the application viewport. The package
component fills its own container and works without the application router or
authentication client.

React and React DOM must satisfy the package's `^19.2.6` peer dependencies.
The workspace exports compiled ESM, declarations, and a separate stylesheet.
These packages are currently workspace packages rather than registry releases.

## Embed a local board

Import the CSS once in your application's entry point:

```tsx
import "@kritzlboard/react/styles.css"
```

Then render a board within a container with a definite height:

```tsx
import { Board, useBoardStore } from "@kritzlboard/react"

export function SketchCard({ boardId }: { boardId: string }) {
  const store = useBoardStore(boardId)

  return (
    <section aria-label="Project sketch" style={{ height: 480 }}>
      {store ? (
        <Board store={store} aria-label="Project drawing" />
      ) : (
        <p>Preparing the drawing…</p>
      )}
    </section>
  )
}
```

The hook returns `null` before its effect creates the requested store. It disposes
of that store on unmount or when `boardId` changes. Do not destroy the hook-owned
store yourself. Two hook calls with the same ID still create separate documents:
the ID is not a local registry, persistence key, or network connection.

The container may be a card, modal body, split pane, or resizable panel. The board
uses its own dimensions and observes resizing. A percentage height needs an
ancestor that establishes a height; an otherwise empty auto-height container
does not give the editor usable space.

## Compose an editor and custom controls

Use one provider, one root, and one canvas per editor. The default control
components can be selected individually; they do not take configuration props.

```tsx
import {
  BoardCanvas,
  BoardProvider,
  BoardRoot,
  BoardStylePanel,
  BoardZoomControls,
  useBoardEditor,
  useBoardStore,
} from "@kritzlboard/react"

function ProjectTools() {
  const editor = useBoardEditor()

  return (
    <div
      role="toolbar"
      aria-label="Project drawing tools"
      style={{ position: "absolute", top: 12, left: 12 }}
    >
      <button
        type="button"
        aria-pressed={editor.tool === "select"}
        onClick={() => editor.setTool("select")}
      >
        Select
      </button>
      <button
        type="button"
        aria-pressed={editor.tool === "rect"}
        onClick={() => editor.setTool("rect")}
      >
        Rectangle
      </button>
      <button
        type="button"
        disabled={editor.selection.size === 0}
        onClick={editor.deleteSelection}
      >
        Delete
      </button>
      <button type="button" onClick={editor.zoomToFit}>
        Fit
      </button>
    </div>
  )
}

export function ProjectEditor() {
  const store = useBoardStore("project")
  if (!store) return null

  return (
    <BoardProvider store={store} initialStyle={{ color: "blue" }}>
      <BoardRoot style={{ height: 480 }} aria-label="Project editor">
        <BoardCanvas />
        <ProjectTools />
        <BoardStylePanel />
        <BoardZoomControls />
      </BoardRoot>
    </BoardProvider>
  )
}
```

Keep custom controls within the provider to use `useBoardEditor`. They can be
outside `BoardRoot` for host layout, but board keyboard shortcuts only run while
focus is within the root. A control outside the root moves focus outside it.
Inside the root, native button activation with Enter or Space is preserved.

Use `type="button"` on controls embedded in a form. Shape colors are named palette
IDs such as `"blue"`, and the rectangle tool ID is `"rect"`. The complete lists
are in the component reference.

`<Board controls={false}>` is a shorter option when only the default controls
need replacing. It still renders an interactive canvas. There is no read-only
mode implied by hiding controls.

Mount the root and canvas together with their provider. Internal measurement
and event effects bind to those mounted elements; conditionally removing and
replacing the root or canvas while retaining the provider is not a supported
composition pattern. Conditionally showing controls is fine.

## Observe document state outside the canvas

Store-subscription hooks do not require a provider. This lets the host keep
inspector, title, and history UI outside the editor layout:

```tsx
import type { BoardStore } from "@kritzlboard/core"
import {
  useBoardName,
  useCanUndoRedo,
  useShapes,
} from "@kritzlboard/react"

export function DocumentInspector({ store }: { store: BoardStore }) {
  const name = useBoardName(store)
  const shapes = useShapes(store)
  const { canUndo, canRedo } = useCanUndoRedo(store)

  return (
    <aside aria-label="Drawing details">
      <label>
        Name
        <input
          value={name}
          onChange={(event) => store.setBoardName(event.target.value)}
        />
      </label>
      <p>{shapes.length} shapes</p>
      <button
        type="button"
        disabled={!canUndo}
        onClick={() => store.undo()}
      >
        Undo
      </button>
      <button
        type="button"
        disabled={!canRedo}
        onClick={() => store.redo()}
      >
        Redo
      </button>
    </aside>
  )
}
```

Treat snapshots as read-only. Change shapes through the core store's mutation
methods rather than mutating objects returned by `useShapes`. The core store
rebuilds cached snapshots and updates bound connectors as part of its document
operations. The board-name metadata is not part of the shape undo history.

## Render a static document preview

`ShapeView` handles rendering without a provider or editing controller. Choose
an SVG view box containing the shapes you want to show:

```tsx
import type { BoardStore } from "@kritzlboard/core"
import { ShapeView, useShapes } from "@kritzlboard/react"

export function DocumentPreview({ store }: { store: BoardStore }) {
  const shapes = useShapes(store)

  return (
    <svg
      role="img"
      aria-label="Drawing preview"
      viewBox="-320 -200 640 400"
      style={{ width: "100%", height: 240 }}
    >
      {shapes.map((shape) => (
        <ShapeView key={shape.id} shape={shape} />
      ))}
    </svg>
  )
}
```

This fixed view box is an example, not automatic fitting: it clips content outside
that region. For arbitrary documents, derive a view box from core geometry
bounds and leave room for strokes and labels. Shape text still uses the package
stylesheet and host-supplied fonts. The host supplies the preview's accessible
description.

## Share a document or add collaboration

Two providers can receive the same core store. They share shapes, document
metadata, and undo history, but retain independent camera, tool, selection,
drawing style, and internal clipboard. Unmounting one provider does not destroy
the store. The owner must keep the store alive until every view using it is gone.

That is different from two remote collaborators. Remote clients create their
own stores and connect them to the same room through `@kritzlboard/sync`.
Remote edits stay outside each client's local undo history.

When a host already owns a connected session, the React bridge is simply:

```tsx
import type { BoardStore } from "@kritzlboard/core"
import type { BoardConnection } from "@kritzlboard/sync"
import { Board } from "@kritzlboard/react"

export function ConnectedDrawing({
  store,
  connection,
}: {
  store: BoardStore
  connection: BoardConnection
}) {
  return (
    <div style={{ height: 480 }}>
      <Board
        store={store}
        presence={connection}
        aria-label="Shared drawing"
      />
    </div>
  )
}
```

The connection synchronizes the store's document. Passing it as `presence`
enables cursor and selection publication and rendering. A custom presence
adapter alone does not synchronize document contents.

The host owns connection creation and disposal. Destroy connections before their
stores. React providers remove their subscriptions and clear their presence on
cleanup; they do not destroy either supplied object. See the
[sync package](../packages/sync/README.md) for connection construction and options.

## Route changes and resource ownership

For local embeds, pass the route's document ID to `useBoardStore`. The hook
returns `null` while the current store does not match that ID. Rendering only
when non-null avoids briefly showing the old document under the new route.

For externally owned stores, apply the same rule: do not render a session whose
store belongs to a previous route. Create network connections in an effect and
dispose of the captured session in that effect's cleanup. Avoid constructing a
store or connection in a render body.

The existing application implements this in
[src/routes/b.$boardId.tsx](../src/routes/b.$boardId.tsx). It creates an
application `BoardStore` in an effect depending on `boardId`, guards mismatched
IDs, and destroys the captured store on cleanup. That application store owns its
connection and destroys it before destroying the core document.

A provider keys its internal editor session by `store.doc.guid`, so replacing
the document resets local view state. Changing only `initialStyle` does not reset
the editor. Use `editor.changeStyle(patch)` for live style changes.

## Persistence and preferences

These are separate responsibilities:

| State | Owner and persistence behavior |
| --- | --- |
| Shapes and board name | Core document; local-only stores are in memory unless the host persists them |
| Camera, tool, selection, editor clipboard | Provider session; not written into the shared document |
| Remote cursor and selection presence | Presence adapter; ephemeral participant state |
| Drawing defaults | Provider session; host may persist via `onStyleChange` |
| Anonymous user identity and recent-board links | Current application localStorage helpers |
| Account session | Current application's Better Auth client/server |
| Server-side board document storage | Current application server configuration |

`onStyleChange` receives complete drawing defaults on initial mount and later
changes; it is not a notification that drawing content changed. The callback
also runs again when its identity changes, so keep persistence callbacks stable.

The current [application wrapper](../src/board/Board.tsx) reads and writes
`kritzlboard:style` in localStorage with best-effort error handling. This stores
preferences, not shape data. The reusable React package performs no localStorage
access. For document persistence, use the core document's state/update APIs or
a server-connected session, and define the host's loading and saving lifecycle.

## CSS and fonts

Import `@kritzlboard/react/styles.css` independently of application styles.
The package uses `kb-` classes and does not reset the host page. Configure
`--kb-background`, `--kb-panel-background`, `--kb-border`, `--kb-accent`,
`--kb-font-sans`, and `--kb-font-hand` on a board root or ancestor.

Fonts are loaded by the host. Defaults select Inter Variable and Caveat Variable
when available, with generic fallbacks. The default toolbar supports horizontal
scrolling in narrow boards, and the zoom controls move above it at widths of
850 pixels or less. Custom controls need their own responsive layout.

Keep each editor's controls and text measurement within that board's CSS context.
The package measures text using a temporary element inside the root and removes
the element immediately after measurement.

## Server rendering and client hydration

The package can be imported and rendered on the server without browser globals.
`useBoardStore` returns `null` there, producing the same initial placeholder that
the client renders before its effect runs. An externally supplied store can
provide server snapshots, but its client hydration state must agree.

Presence has an empty server snapshot. Measurements, event listeners, focus, and
text editing activate after mount. In React Server Component applications,
create the store and use these hooks in a client component. A live store or
connection cannot be passed as a serialized server-component prop.

The full application is a client-rendered SPA mounted with `createRoot`; its
application store constructor derives browser location and identity and opens a
connection. That constructor is not the server-safe core store.

## Internal code map

| File | Responsibility |
| --- | --- |
| [index.ts](../packages/react/src/index.ts) | Supported public exports and client entry |
| [types.ts](../packages/react/src/types.ts) | `BoardOptions`, `BoardPresence`, and public `BoardEditor` contract |
| [Board.tsx](../packages/react/src/Board.tsx) | Convenience composition, root, and context-connected control wrappers |
| [context.tsx](../packages/react/src/context.tsx) | Provider session, private context, and public editor hook |
| [hooks.ts](../packages/react/src/hooks.ts) | Core-store and optional-presence subscriptions; local store lifecycle |
| [useBoardController.ts](../packages/react/src/useBoardController.ts) | Internal gesture sessions, keyboard/wheel handling, camera, selection, and style actions |
| [BoardCanvas.tsx](../packages/react/src/BoardCanvas.tsx) | Grid, SVG shape tree, selection/binding/presence overlays, and active text editor |
| [ShapeView.tsx](../packages/react/src/ShapeView.tsx) | Shape rendering using core geometry, palettes, typography, and freehand paths |
| [SelectionOverlay.tsx](../packages/react/src/SelectionOverlay.tsx) | Selection bounds, handles, brush region, and peer selections |
| [BindingOverlay.tsx](../packages/react/src/BindingOverlay.tsx) | Connection target and attachment preview |
| [PeerCursors.tsx](../packages/react/src/PeerCursors.tsx) | Peer cursor rendering in the current camera |
| [TextEditor.tsx](../packages/react/src/TextEditor.tsx) | HTML text editing aligned to SVG shapes; commit, resizing, and finish behavior |
| [Toolbar.tsx](../packages/react/src/Toolbar.tsx) | Internal default tool picker and history buttons |
| [StylePanel.tsx](../packages/react/src/StylePanel.tsx) | Internal style controls and visibility by tool/selection |
| [ZoomBar.tsx](../packages/react/src/ZoomBar.tsx) | Internal zoom controls |
| [measureText.ts](../packages/react/src/measureText.ts) | Root-scoped temporary text measurement |
| [typography.ts](../packages/react/src/typography.ts) | Package-specific font CSS variables |
| [classes.ts](../packages/react/src/classes.ts) | Small class-name helper |
| [styles.css](../packages/react/src/styles.css) | Standalone scoped board and control styling |

`BoardCanvas` reads private controller context, renders shapes under the camera
transform, and passes input events to the controller. The controller converts
screen positions to world coordinates and delegates document changes to core
store methods. The resulting store notification refreshes cached shapes and
causes subscribed rendering to update.

The controller's active pointer session distinguishes pan, move, resize,
endpoint editing, selection brushing, freehand draw, box creation, line creation,
and erase. These session details are private; external controls should call
`useBoardEditor`, not import the controller.

`TextEditor` writes text changes through the store, resizes standalone text and
box labels as needed, and deletes empty standalone text shapes when editing
finishes. It defers focus with an animation frame and cancels that frame on
cleanup. It stops keyboard/pointer propagation so typing does not trigger the
board's shortcuts.

The relevant regression suites are
[Board.test.tsx](../packages/react/src/Board.test.tsx),
[embedding.test.tsx](../packages/react/src/embedding.test.tsx), and
[ssr.test.tsx](../packages/react/src/ssr.test.tsx). They cover drawing/editing,
independent embeds and lifecycle cleanup, and rendering without browser globals.

