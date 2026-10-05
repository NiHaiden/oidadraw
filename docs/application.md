# Application guide and frontend reference

[Documentation home](README.md) · [Setup](getting-started.md) · [Architecture](architecture.md) · [Hooks](hooks.md)

## Create, reopen, and share a board

On the home page, choose **New board**. The browser generates a ten-character board ID and navigates to `/b/<boardId>`. Opening the URL establishes a synchronized document; the frontend does not call a separate create-board endpoint.

The title field in the board's top bar updates shared document metadata. Other connected clients see the change. An empty title is displayed as “Untitled board” in the recent-board list.

**Share** copies the current URL. A rejected clipboard write falls back to a prompt containing the link. Share that URL to join the same room. Sharing does not create an invitation record, an access-control list, or a read-only link.

By default, people who can reach the instance and know the URL can edit the board. `REQUIRE_AUTH=1` adds an instance-wide sign-in gate. It does not make boards private to their creator.

## Accounts, presence, and recent boards

The login page supports email/password sign-in and sign-up. On success it returns to the requested board or the home page. The account name is used to update the browser's presence identity.

The board top bar shows remote peer avatars and the local identity. Up to five remote avatars are shown individually, followed by an overflow count. The local avatar opens a name field and account actions.

Changing the presence name changes the browser identity and the active connection's awareness state. It does not update the account's stored profile name. Presence colors are chosen from an application palette when a local identity is created.

Recent boards work differently by session state:

| State | Recent-board behavior |
| --- | --- |
| Signed out | Uses this browser's anonymous localStorage list, capped at 24 entries |
| Signed in | Loads account bookmarks from the server and merges anonymous local entries not already present |
| Signed-in list request fails | Falls back to the browser's anonymous list |
| Open a board while signed in | Records the visit on the account |
| Open or rename a board while signed out | Updates the local recent entry |
| Remove a recent entry | Removes the local entry and, if signed in, attempts to remove the account bookmark |

Removing a recent entry does **not** delete the drawing, revoke anyone's access, or remove the server's saved document. Account boards are not copied into anonymous recents simply because they were visited while signed in.

## Drawing and editing

The editor includes selection, hand/pan, freehand drawing, erasing, rectangles, ellipses, lines, arrows, and text.

- Drag an empty area with the selection tool to make a brush selection.
- Click or drag shapes to select and move them. Shift supports additive selection and constrained movement.
- Drag selection handles to resize. Shift on a corner preserves the aspect ratio.
- Drag with a rectangle or ellipse tool to create a shape; Shift creates equal dimensions.
- Lines and arrows can attach to other shapes. Binding previews show candidate attachment points, and connected endpoints follow their target.
- Double-click an editable shape, or press Enter with one editable shape selected, to edit its text or label.
- Rectangle and ellipse labels can grow their container vertically. Empty standalone text is removed when editing finishes; an empty label is allowed.
- Style controls apply to selected shapes and update the defaults used for new shapes. The product saves those defaults as a browser preference.
- Undo/redo affects local shape edits, not board-title changes. Remote edits are not part of a client's local undo history.

The style panel's visibility depends on the current tool and selection. Selecting a shape or choosing a creation tool can reveal controls that are absent when an empty selection is active.

### Pan and zoom

Use the hand tool, hold Space while dragging, or use the middle mouse button to pan. Wheel/trackpad movement pans; Ctrl/Cmd with the wheel zooms around the pointer. The zoom controls provide zoom in, zoom out, 100%, and fit-to-content.

The current editor clamps zoom between 10% and 800%. Camera state belongs to the current editor, not the shared document. One participant zooming does not change another participant's view.

### Keyboard reference

Shortcuts operate while focus is within the board root. They do not intercept normal editing in inputs, textareas, selects, or contenteditable text. Click the canvas after using controls rendered outside the board root.

“Mod” means Ctrl on Windows/Linux or Cmd on macOS.

| Key | Action |
| --- | --- |
| `V` | Select tool |
| `H` | Hand tool |
| `P` or `D` | Freehand drawing |
| `R` | Rectangle |
| `O` | Ellipse |
| `L` | Line |
| `A` | Arrow |
| `T` | Text |
| `E` | Eraser |
| `Delete` or `Backspace` | Delete selection |
| `Escape` | Clear selection and return to selection tool; while editing text, finish editing |
| `Enter` | Edit the only selected shape's text/label when supported |
| `Space` + drag | Temporary pan |
| `Mod+A` | Select all shapes |
| `Mod+D` | Duplicate selected shapes |
| `Mod+C` / `Mod+X` / `Mod+V` | Copy / cut / paste through the editor's internal shape buffer |
| `Mod+Z` | Undo |
| `Mod+Shift+Z` or `Mod+Y` | Redo |
| `Mod++` / `Mod+=` | Zoom in |
| `Mod+-` | Zoom out |
| `Mod+0` | Reset zoom to 100% around the viewport center |

Copy/paste uses an in-memory buffer belonging to one editor. It is not a serialized system-clipboard format, and separate board instances do not share it. Pasting or duplicating a selected group remaps connector bindings within that group.

## What is saved

| Data | Stored where |
| --- | --- |
| Shapes and board title | Server PostgreSQL snapshot after synchronization |
| Account credentials/session data | Auth tables in PostgreSQL |
| Account's recent-board visits | `user_boards` in PostgreSQL |
| Anonymous name and color | `kritzlboard:user` in localStorage |
| Anonymous recent boards | `kritzlboard:recents` in localStorage |
| Last-used style defaults | `kritzlboard:style` in localStorage |
| Camera, selection, active tool, shape clipboard | Current editor memory |
| Live cursor and remote selection presence | Temporary awareness state |

The browser's recent list is not a backup of a drawing. There is no IndexedDB/localStorage persistence of the Yjs document in the current application.

The “Online” indicator reflects a connected WebSocket. Edits are applied locally immediately and saved on the server asynchronously. The indicator does not confirm that an individual edit reached PostgreSQL. While offline, unsent edits survive only as long as the in-memory document remains alive.

## Routes and application components

| Export or component | Source | Contract |
| --- | --- | --- |
| `getRouter()` | [router.tsx](../src/router.tsx) | Creates the product router from the generated route tree, with scroll restoration and intent preloading |
| Root `Route` | [routes/__root.tsx](../src/routes/__root.tsx) | Renders child routes through an outlet and a simple not-found view |
| Home `Route` / private `Home` | [routes/index.tsx](../src/routes/index.tsx) | New board navigation, merged recents, account actions |
| Login `Route` / private `LoginPage` | [routes/login.tsx](../src/routes/login.tsx) | Optional string `redirect` search value; sign-in/sign-up form |
| Board `Route` / private `BoardPage` | [routes/b.$boardId.tsx](../src/routes/b.$boardId.tsx) | Before-load auth check and effect-owned application store |
| Application `Board({ store })` | [board/Board.tsx](../src/board/Board.tsx) | Composes the package board, presence connection, saved styles, and top bar in a full-screen container |
| `TopBar({ store })` | [board/TopBar.tsx](../src/board/TopBar.tsx) | Title, status, peers, local identity, sharing, auth links, visit recording |
| Application `BoardStore` | [board/store.ts](../src/board/store.ts) | Extends core store, owns a sync connection, chooses same-origin/default URL and current user |
| `Button`, `buttonVariants` | [components/ui/button.tsx](../src/components/ui/button.tsx) | Application button primitive and variant class function |

These product components are not exports of `@kritzlboard/react`. Another application should embed the package's board and provide its own navigation, account controls, and preferences.

The home page's private `AccountCorner` handles session actions. `markerFor`, `timeAgo`, and `Squiggle` format recent cards. The top bar's private `Avatar` and `initials` render identity badges. These are implementation helpers, not shared package APIs.

### Application Button

`Button` accepts ordinary React button props plus:

| Prop | Values/default | Behavior |
| --- | --- | --- |
| `variant` | `default` (default), `outline`, `secondary`, `ghost`, `destructive`, `link` | Selects application-theme styles |
| `size` | `default` (default), `xs`, `sm`, `lg`, `icon`, `icon-xs`, `icon-sm`, `icon-lg` | Selects dimensions and spacing |
| `asChild` | `false` | When true, uses Radix Slot to apply behavior/styles to the child element |
| `className` | Optional | Merged with variant styles through `cn` |

```tsx
<Button variant="outline" size="sm" asChild>
  <Link to="/login">Sign in</Link>
</Button>
```

The component does not force a button `type`; specify `type="button"` for non-submit actions in a form. The package's board controls use their own CSS rather than this Tailwind-based primitive.

## Frontend helper API

### Authentication — `src/lib/auth-client.ts`

| Export | Contract |
| --- | --- |
| `authClient` | Same-origin Better Auth client |
| `signIn`, `signUp`, `signOut` | Client operations reexported from Better Auth; the login form calls `signIn.email` and `signUp.email` |
| `useSession` | Better Auth hook used for `data` and `isPending`; see [Hooks](hooks.md) |
| `ServerConfig` | `{ requireAuth: boolean }` |
| `getServerConfig(): Promise<ServerConfig>` | Fetches `/api/config`; returns `{ requireAuth: false }` on a rejected/non-successful request or parse error |

The config fallback is UI behavior, not server authorization. WebSocket authentication is independently enforced in the backend.

### Account bookmarks — `src/lib/boards.ts`

| Function | Behavior |
| --- | --- |
| `fetchMyBoards(): Promise<RecentBoard[]>` | GET `/api/boards`; throws on non-successful HTTP status or request/parse failure |
| `touchBoardOnServer(id): void` | Starts POST `/api/boards/<encoded-id>/touch`; ignores network rejection and does not inspect the HTTP status |
| `removeBoardOnServer(id): Promise<void>` | Sends DELETE `/api/boards/<encoded-id>`; ignores network rejection and does not inspect the HTTP status |

The touch/delete helpers are best-effort UI actions. They do not report successful persistence or authorization to the caller. The homepage updates its displayed list immediately after removal.

### Browser identity and recents — `src/lib/user.ts`

These are plain functions, not React hooks.

| Export | Behavior |
| --- | --- |
| `getUser(): UserInfo` | Returns a stored nonempty name/color pair, or creates a random adjective/animal name and cursor color; attempts to persist it |
| `setUserName(name): UserInfo` | Trims the name; empty input keeps the existing name; returns and attempts to persist the updated identity |
| `RecentBoard` | `{ id: string; name: string; at: number }`, where `at` is a millisecond timestamp |
| `getRecentBoards(): RecentBoard[]` | Parses the stored list, or returns an empty list if absent/unreadable |
| `touchRecentBoard(id, name): void` | Deduplicates by ID, prepends a current timestamp, and limits the list to 24 entries |
| `removeRecentBoard(id): void` | Filters an ID out of the stored list |

On module load, legacy `oidadraw:user`, `oidadraw:recents`, and `oidadraw:style` values are copied to their `kritzlboard:` equivalents only if the new key is absent, then the old key is removed.

Storage reads/writes catch browser storage failures. They are not a reactive store or a complete runtime schema-validation layer. Calling a helper does not automatically update every mounted component or synchronize identities between open tabs. Callers manage their own React state and publish presence changes explicitly.

### Classes and styles

`cn(...inputs: ClassValue[]): string` in [utils.ts](../src/lib/utils.ts) combines `clsx` conditional classes with `tailwind-merge` conflict resolution.

The application stylesheet imports Tailwind, animation utilities, Inter, and Caveat. It defines product design tokens and the full-viewport `.application-board` container. The reusable board stylesheet is imported separately from `@kritzlboard/react/styles.css`; see [React styling](react.md).

## Related references

- [Hooks](hooks.md): public hooks, the application status hook, and the private controller.
- [React components](../packages/react/docs/components.md): props, context, composition, and lifecycle.
- [Server](server.md): authoritative endpoint and authorization behavior.
- [Development](development.md): how to change routes, shapes, interactions, or storage.

