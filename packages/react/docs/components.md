# React components and hooks

`@kritzlboard/react` renders an editable board from a `BoardStore` supplied by
`@kritzlboard/core`. Use `Board` for the assembled editor, or compose its provider,
canvas, and controls into your application's layout. Collaboration is optional:
the editor accepts a presence adapter without depending on a WebSocket server.

This reference covers every public component, hook, and type exported by the
React package. Internal helpers such as `SelectionOverlay`, `BindingOverlay`,
and `TextEditor` are not separately supported components.

## Setup

The package requires React and React DOM `^19.2.6`. It exports compiled ESM and
TypeScript declarations. The workspace package has not been published to a
registry. Import its stylesheet once and give each board a container with a
nonzero height. Tailwind, the application router, and the application stylesheet
are not required.

```tsx
import { Board, useBoardStore } from '@kritzlboard/react'
import '@kritzlboard/react/styles.css'

export function Sketch() {
  const store = useBoardStore('sketch')

  if (!store) return <p>Preparing the board…</p>

  return (
    <div style={{ height: 480 }}>
      <Board store={store} aria-label="Project sketch" />
    </div>
  )
}
```

`useBoardStore` creates an in-memory store after mounting. Its first render returns
`null`; the hook destroys its own store on cleanup. A board ID identifies that
local store. It does not enable persistence, connect to a server, or make two
independently created stores share a document.

## Components at a glance

| Export | Purpose | Context required |
| --- | --- | --- |
| `Board` | Assembled editor with canvas and default controls | None; creates its own provider |
| `BoardProvider` | Owns one editor session's interaction state | None |
| `BoardRoot` | Sized, focusable editor container | `BoardProvider` |
| `BoardCanvas` | Interactive SVG surface and editing overlays | `BoardProvider` and a surrounding `BoardRoot` |
| `BoardToolbar` | Tool selection and undo/redo controls | `BoardProvider` |
| `BoardStylePanel` | Appearance controls for the current tool or selection | `BoardProvider` |
| `BoardZoomControls` | Zoom in, zoom out, reset, and fit controls | `BoardProvider` |
| `ShapeView` | SVG rendering for a single shape | SVG rendering context; no editor provider |

For each editor, mount one `BoardRoot` and one `BoardCanvas` inside its provider.
Separate providers give multiple boards independent tools, selection, camera,
style, and clipboard state. Sharing a store shares the document; using different
stores isolates the document as well.

## `Board`

The convenience component assembles `BoardProvider`, `BoardRoot`, `BoardCanvas`,
`BoardToolbar`, `BoardStylePanel`, and `BoardZoomControls`. Its `children` render
inside the editor context and root, after the canvas and default controls.

| Prop | Required | Behavior |
| --- | --- | --- |
| `store` | Yes | The core `BoardStore` to display and edit. The caller retains ownership. |
| `presence` | No | A `BoardPresence` adapter for remote cursors and selection presence. Omit for a local editor. |
| `initialStyle` | No | Partial initial drawing-style settings. Unspecified fields use the defaults below. This initializes state; it is not a controlled style prop. |
| `onStyleChange` | No | Receives the complete settings in an effect on mount, when settings change, and when the callback identity changes. |
| `controls` | No | Defaults to `true`. Set `false` to omit the default toolbar, style panel, and zoom controls. The canvas remains editable. |
| `children` | No | Additional content inside the editor's root and provider. |
| `className` | No | Additional class on the root container. |
| `style` | No | Inline CSS for the root container, distinct from `initialStyle`. |
| `aria-label` | No | Accessible name for the editor region; defaults to `"Drawing board"`. |

The component also accepts `HTMLAttributes<HTMLDivElement>` except `onChange`.
Its root fixes the role to `region` and `tabIndex` to `0`. Use `BoardProps` when
writing wrappers rather than duplicating the prop type.

`initialStyle` accepts these core `StyleDefaults` fields:

| Field | Accepted values | Initial default |
| --- | --- | --- |
| `color` | `black`, `grey`, `violet`, `blue`, `cyan`, `green`, `yellow`, `orange`, `red` | `black` |
| `fill` | `none`, `semi`, `solid` | `none` |
| `strokeStyle` | `solid`, `dashed`, `dotted` | `solid` |
| `size` | `s`, `m`, `l` | `m` |
| `font` | `sans`, `hand` | `sans` |
| `textSize` | `s`, `m`, `l`, `xl` | `m` |

For example, `initialStyle={{ color: 'blue', fill: 'semi' }}` sets two defaults
while retaining the others. Colors are palette IDs, not arbitrary CSS color
strings. `onStyleChange` is a settings notification, not a document-change
callback; subscribe to the store to observe drawing edits. Keep the callback
stable if it performs persistence work.

```tsx
import { Board, useBoardEditor, useBoardStore } from '@kritzlboard/react'

function FitButton() {
  const editor = useBoardEditor()

  return (
    <button
      type="button"
      onClick={editor.zoomToFit}
      style={{ position: 'absolute', top: 12, right: 12 }}
    >
      Show everything
    </button>
  )
}

export function MinimalEditor() {
  const store = useBoardStore('minimal')
  if (!store) return null

  return (
    <div style={{ height: 400 }}>
      <Board store={store} controls={false} aria-label="Minimal editor">
        <FitButton />
      </Board>
    </div>
  )
}
```

Hiding controls is not a read-only mode: canvas gestures and keyboard editing
remain active.

## `BoardProvider`

`BoardProvider` supplies editor context and accepts `BoardOptions` plus required
`children`: `store`, optional `presence`, optional `initialStyle`, and optional
`onStyleChange`. It does not supply the canvas or visual controls.

The initial tool is `select`, selection is empty, and zoom is `1` (100%). Browser
measurement places the world origin at the center of the container. The provider
manages camera, active tool, selection, drawing style, and interaction state. It
subscribes to the supplied store and optional presence adapter. On unmount it
removes its subscriptions and clears its cursor and selection presence. It does
**not** destroy the caller's store or transport.

Changing the underlying document's GUID starts a new editor session. Keep a
stable store for a board's lifetime. Create local stores with `useBoardStore`, or
manage external stores and connections in the host application.

```tsx
import {
  BoardCanvas,
  BoardProvider,
  BoardRoot,
  BoardStylePanel,
  BoardToolbar,
  BoardZoomControls,
  useBoardStore,
} from '@kritzlboard/react'

export function ComposedEditor() {
  const store = useBoardStore('composed')
  if (!store) return null

  return (
    <div style={{ height: 480 }}>
      <BoardProvider store={store}>
        <BoardRoot aria-label="Composed editor">
          <BoardCanvas />
          <BoardToolbar />
          <BoardStylePanel />
          <BoardZoomControls />
        </BoardRoot>
      </BoardProvider>
    </div>
  )
}
```

## `BoardRoot`

`BoardRoot` is the editor's sized and focusable HTML container. It requires
`BoardProvider` and accepts `HTMLAttributes<HTMLDivElement>`, including
`children`, `className`, `style`, and `aria-label`. Place `BoardCanvas` and any
default controls inside it.

It always renders a `div` with `role="region"`, `tabIndex={0}`, the `kb-root`
class, and editor-owned cursor attributes. `aria-label` defaults to
`"Drawing board"`. A supplied `className` is appended, and a supplied `onBlur` is
called after the root's focus cleanup. It does not forward a caller-owned ref.

The root fills its containing element and provides the positioning context for
overlays. Resize observation keeps the camera aligned with the board's own
container. Size the container explicitly; a percentage height is effective only
when an ancestor establishes a height.

The root scopes keyboard shortcuts to that editor. Interacting with its canvas
focuses it. Shortcuts ignore text inputs and editable content, so typing in the
host application's forms does not operate the board. Space-to-pan is cleared
when focus leaves the editor or the browser window loses focus.

Give multiple roots distinct accessible names.

## `BoardCanvas`

`BoardCanvas` takes its editor state from context and accepts no props. Mount it
inside `BoardRoot` under `BoardProvider`.

It renders the grid, shapes, local selection and binding overlays, remote peers
when presence is available, and the text editor when text is being edited. It
also connects pointer, wheel, and editing interactions to the controller.

Omitting the default controls does not disable these interactions. For a static
shape preview, render `ShapeView` inside your own SVG instead.

## `BoardToolbar`

`BoardToolbar` reads its store, active tool, and tool-change actions from editor
context and accepts no props. It offers selection, panning, freehand drawing,
erasing, rectangle, ellipse, line, arrow, and text tools, plus undo and redo.
Undo/redo availability follows the supplied store.

The default stylesheet positions it inside `BoardRoot`. Use your own controls
with `useBoardEditor` when you need a different tool set or layout. Own controls
should use `type="button"` when embedded inside a host form.

## `BoardStylePanel`

`BoardStylePanel` accepts no props and obtains style and selection state from
context. It renders for drawing tools (`draw`, `rect`, `ellipse`, `line`, `arrow`,
`text`) or when at least one shape is selected. It returns no panel when there is
no selection and the tool is `select`, `hand`, or `eraser`.

Color is always available when the panel is visible. Fill appears for rectangles
and ellipses; stroke style appears for rectangles, ellipses, lines, and arrows.
Size controls outline width or pen size. Font and text size appear for
text-capable tools and shapes. Style changes update the editor's drawing
settings and applicable selected shapes.

Use `initialStyle` on `Board` or `BoardProvider` to seed drawing settings. Use
`useBoardEditor().changeStyle(...)` for changes after mounting. Persist
preferences in the host through `onStyleChange` if desired; the package does not
write to local storage.

## `BoardZoomControls`

`BoardZoomControls` accepts no props. It displays the current zoom and offers
zoom in, zoom out, reset, and zoom to fit through editor context. Calculations
use the board's canvas bounds, allowing boards to work in cards and split panes.

For custom controls, use `zoomIn`, `zoomOut`, `resetZoom`, and `zoomToFit` from
`useBoardEditor`. Zoom in multiplies the scale by `1.25`, and zoom out divides by
`1.25`; the permitted range is `0.1` to `8` (10% to 800%). Reset restores 100%
around the current viewport center rather than resetting the document position.
Fit considers all shapes, limits its result to 150%, and does nothing for an
empty document.

## `ShapeView`

`ShapeView` renders one core shape as SVG content. Place it inside an SVG element.
It does not create an editor, subscribe to a store, handle selection, or add
editing controls. No `BoardProvider` is required.

| Prop | Required | Behavior |
| --- | --- | --- |
| `shape: Shape` | Yes | A core rectangle, ellipse, line, arrow, freehand, or text shape. |
| `fadeOut?: boolean` | No | `true` renders at opacity `0.4`; omitted or `false` renders at opacity `1`. |
| `hideLabel?: boolean` | No | `true` hides labels on rectangles, ellipses, lines, and arrows. Omitted or `false` displays labels. Standalone text is unaffected. |

Normal previews can omit the flags. Use `ComponentProps<typeof ShapeView>` when
forwarding rendering props so wrappers stay aligned with package declarations.

```tsx
import type { ComponentProps } from 'react'
import { ShapeView } from '@kritzlboard/react'

type ShapePreviewProps = {
  shape: ComponentProps<typeof ShapeView>['shape']
  viewBox: string
}

export function ShapePreview({ shape, viewBox }: ShapePreviewProps) {
  return (
    <svg role="img" aria-label="Shape preview" viewBox={viewBox}>
      <ShapeView shape={shape} />
    </svg>
  )
}
```

Choose a `viewBox` containing the shape's world-coordinate bounds, with room for
its stroke and labels. Import the package stylesheet for text styling. The host
provides the preview's accessibility text.

## Hooks

### `useBoardEditor()`

Returns the public `BoardEditor` for the surrounding `Board` or `BoardProvider`.
Call it from a descendant component. Without editor context, it throws
`"Board components must be inside a BoardProvider"`.

| Member | Purpose |
| --- | --- |
| `store: BoardStore` | The supplied core store, for document operations. |
| `camera: Camera` | Current viewport state: `x`, `y`, and scale `z`. |
| `tool: ToolId` | Current active tool. |
| `selection: ReadonlySet<string>` | Current selected shape IDs. |
| `selectedShapes: Shape[]` | Shapes resolved from the current selection. |
| `style: StyleDefaults` | Current drawing-style settings. |
| `setTool(tool: ToolId)` | Select an editor tool. |
| `setSelection(selection: ReadonlySet<string>)` | Replace the selected shape IDs; pass a new set. |
| `changeStyle(patch: Partial<StyleDefaults>)` | Apply a partial style change. |
| `deleteSelection()` | Remove the selected shapes. |
| `duplicateSelection()` | Duplicate the selected shapes. |
| `selectAll()` | Select every shape and activate the select tool. |
| `zoomIn()` | Increase the viewport zoom. |
| `zoomOut()` | Decrease the viewport zoom. |
| `resetZoom()` | Restore 100% zoom around the viewport center. |
| `zoomToFit()` | Fit all document shapes within the board viewport. |

Tool IDs are `select`, `hand`, `draw`, `rect`, `ellipse`, `line`, `arrow`, `text`,
and `eraser`. Actions return `void`. Camera is observable but has no public setter;
use the zoom actions. Undo and redo are available on `editor.store`.

```tsx
import { useBoardEditor } from '@kritzlboard/react'

export function DrawingTools() {
  const editor = useBoardEditor()

  return (
    <div role="toolbar" aria-label="Drawing tools">
      <button
        type="button"
        aria-pressed={editor.tool === 'select'}
        onClick={() => editor.setTool('select')}
      >
        Select
      </button>
      <button type="button" onClick={() => editor.setTool('rect')}>
        Rectangle
      </button>
      <button type="button" onClick={editor.deleteSelection}>
        Delete selected
      </button>
      <button type="button" onClick={editor.zoomToFit}>
        Fit drawing
      </button>
    </div>
  )
}
```

Place custom controls inside the provider. To lay out a toolbar outside the
canvas, compose `BoardProvider`, `BoardRoot`, and `BoardCanvas` yourself rather
than relying on the built-in controls' overlay positioning.

### `useBoardStore(boardId = 'local')`

Returns `BoardStore | null`. It creates a core store in an effect and destroys
that store when the component unmounts or the board ID changes. Until the
requested store exists, it returns `null`. Its lifecycle supports Strict Mode.

The hook does not require `BoardProvider`. It owns the returned store, so do not
manually destroy it or retain it after the hook's component unmounts. It does not
enable networking, persistence, or shared state by board ID.

### `useShapes(store)`

Signature: `useShapes(store: BoardStore): Shape[]`.

Subscribes to the store and returns its current shapes. No editor context is
required. Use it for host-side inspectors, shape counts, and SVG previews.

```tsx
import type { BoardStore } from '@kritzlboard/core'
import { useShapes } from '@kritzlboard/react'

export function ShapeCount({ store }: { store: BoardStore }) {
  const shapes = useShapes(store)
  return <output>{shapes.length} shapes</output>
}
```

### `usePeers(presence?)`

Signature: `usePeers(presence?: BoardPresence): PeerState[]`.

Subscribes to the optional presence adapter and returns its peers. No editor
context is required. With no adapter, it returns a stable empty array. The server
snapshot is also empty, so presence appears after client hydration.

The adapter must return stable cached snapshots until peer data changes. This
hook observes presence; it does not create a transport or establish a connection.

### `useBoardName(store)`

Signature: `useBoardName(store: BoardStore): string`.

Subscribes to the store and returns its current board name. No editor context is
required. Use it for a host-owned document heading or title control. Change the
name through the store's document API.

### `useCanUndoRedo(store)`

Signature: `useCanUndoRedo(store: BoardStore): { canUndo: boolean; canRedo: boolean }`.

Subscribes to undo/redo availability. No editor context is required. Disable
custom buttons using the booleans and invoke `store.undo()` or `store.redo()`.

All store-observation hooks unsubscribe on unmount. They do not destroy the
supplied store. `useShapes`, `useBoardName`, and `useCanUndoRedo` use the store's
current values as their server snapshots.

## Public types

The package exports `BoardProps`, `BoardOptions`, `BoardEditor`, and
`BoardPresence`. Associated document types such as `BoardStore`, `Shape`,
`StyleDefaults`, `ToolId`, `Camera`, and `PeerState` come from `@kritzlboard/core`.

### `BoardProps`

The props accepted by `Board`: shared editor options, optional default controls,
children, and HTML root attributes other than `onChange`.

```ts
import type { HTMLAttributes } from 'react'
import type { BoardOptions } from '@kritzlboard/react'

interface BoardProps
  extends BoardOptions, Omit<HTMLAttributes<HTMLDivElement>, 'onChange'> {
  controls?: boolean
}
```

Import `BoardProps` directly from `@kritzlboard/react` in application code; the
declaration above is shown to explain the contract.

### `BoardOptions`

Configuration shared by `Board` and `BoardProvider`:

```ts
import type { BoardStore, StyleDefaults } from '@kritzlboard/core'
import type { BoardPresence } from '@kritzlboard/react'

interface BoardOptions {
  store: BoardStore
  presence?: BoardPresence
  initialStyle?: Partial<StyleDefaults>
  onStyleChange?: (style: StyleDefaults) => void
}
```

Drawing settings and CSS are separate: `initialStyle` configures shapes, while
the `style` prop on `Board` or `BoardRoot` configures layout and CSS.

### `BoardEditor`

The public context value returned by `useBoardEditor`, containing all the fields
and methods listed in that hook's reference. Camera, tool, selection, and drawing
style belong to the editor session. Shapes and metadata belong to the core store.
Use indexed access types such as `BoardEditor['selection']` when building controls
that accept a particular portion of the editor state.

### `BoardPresence`

A transport-neutral contract, separate from the shape store:

```ts
import type { PeerState } from '@kritzlboard/core'

interface BoardPresence {
  subscribe: (listener: () => void) => () => void
  getPeers: () => Array<PeerState>
  setCursor: (cursor: { x: number; y: number } | null) => void
  setSelectionPresence: (selection: Array<string>) => void
}
```

| Member | Contract |
| --- | --- |
| `subscribe` | Register a change listener and return an unsubscribe function. |
| `getPeers` | Return a cached peer snapshot; preserve its identity while the data is unchanged. |
| `setCursor` | Publish the local cursor in world coordinates, or clear it with `null`. |
| `setSelectionPresence` | Publish local selected shape IDs; an empty array clears them. |

`PeerState` contains a numeric `clientId`, a `user` with `name` and CSS `color`, a
world-coordinate `cursor` or `null`, and a `selection` array of shape IDs. Cursor
coordinates are document coordinates, not page or screen pixels.

Keep the adapter and subscription functions stable. Methods used as callbacks
must retain their receiver when needed, through arrow functions or binding.
The host owns connection startup, authorization, and destruction. A
`BoardConnection` from [`@kritzlboard/sync`](../../sync/README.md) implements this
contract and can be passed directly as `presence`.

## Styling and fonts

Import `@kritzlboard/react/styles.css` once. The stylesheet uses scoped `kb-`
classes and supplies its own control styles, without a global reset or font
imports. Customize CSS variables on a board's container or root:

```css
.project-board {
  --kb-background: #f8fafc;
  --kb-panel-background: #ffffff;
  --kb-border: #cbd5e1;
  --kb-accent: #2563eb;
  --kb-font-sans: system-ui, sans-serif;
  --kb-font-hand: cursive;
}
```

Use `className="project-board"` on `Board` or `BoardRoot`. The default background
is `#fafaf9`, panel background is `#fff`, border is `#e5e5e5`, and accent is
`#2563eb`. Default fonts use Inter Variable and Caveat Variable when available,
with generic fallbacks. The host loads any custom fonts.

The default toolbar scrolls horizontally in narrow containers, and the zoom
controls move above it when the board width is at most 850 pixels. Check custom
controls at the embed sizes your application supports.

## Server rendering and lifecycle

- Imports and server rendering do not require browser globals.
- `useBoardStore` returns `null` during server rendering because its store is
  created after mounting. Render a deterministic placeholder in that case.
- With an externally supplied store, server rendering reads that store's current
  snapshots. Supply corresponding document state when hydrating.
- Peer presence has an empty server snapshot. Browser measurement, pointer
  interaction, focus, and text editing become active on the client.
- In React Server Component applications, render the editor from a client
  component. Create the live store or transport on the client rather than
  serializing it through a server-component boundary.
- `Board` and `BoardProvider` clean up editor subscriptions and clear presence,
  while preserving caller-owned stores and transports. The host must dispose of
  resources it creates when they are no longer needed.

## Integration boundaries

The React package provides editing UI, not authentication, storage, a router, or
a server. The host chooses those integrations. Default controls can be omitted
and replaced individually; the canvas still handles editing. There is no
read-only prop or controlled camera setter on this component surface.

Keyboard shortcuts operate on the focused editor. Each editor keeps its own
internal clipboard; it does not provide operating-system clipboard integration.
Host inputs retain normal text editing. Custom controls should provide labels,
preserve keyboard access, and use `type="button"` to avoid submitting host forms.
