/**
 * kritzlboard sync server.
 *
 * One process that:
 *  - speaks the y-websocket protocol on ws://…/sync/<boardId> (compatible
 *    with the y-websocket client provider)
 *  - persists each board as a Yjs update in Postgres (board table)
 *  - handles auth (BetterAuth) on /api/auth/*
 *  - serves the built client from ../dist with an SPA fallback
 *
 * Runs directly with Node >= 23 (type stripping): `node server/main.ts`
 *
 * Env: PORT (default 8080), HOST (default "::" = dual-stack),
 *      DATABASE_URL (default postgres://kritzlboard:kritzlboard@localhost:5432/kritzlboard),
 *      BETTER_AUTH_SECRET (set to a long random string in production),
 *      REQUIRE_AUTH (=1 to only allow signed-in users on boards),
 *      DATA_DIR (legacy .yjs board files, imported into Postgres on first open)
 */
import http from "node:http"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { readFile } from "node:fs/promises"
import { createReadStream, existsSync, statSync } from "node:fs"
import { WebSocketServer } from "ws"
import * as Y from "yjs"
import * as encoding from "lib0/encoding"
import * as decoding from "lib0/decoding"
import * as syncProtocol from "y-protocols/sync"
import * as awarenessProtocol from "y-protocols/awareness"
import { and, desc, eq } from "drizzle-orm"
import { migrate } from "drizzle-orm/node-postgres/migrator"
import { toNodeHandler, fromNodeHeaders } from "better-auth/node"
import { db, pool } from "./db.ts"
import { board, userBoard } from "./schema.ts"
import { auth, TRUSTED_ORIGINS } from "./auth.ts"
import type { Duplex } from "node:stream"
import type WebSocket from "ws"

const PORT = Number(process.env.PORT ?? 8080)
const HOST = process.env.HOST ?? "::"
const DATA_DIR = path.resolve(process.env.DATA_DIR ?? "./data")
const REQUIRE_AUTH = ["1", "true", "yes"].includes(
  (process.env.REQUIRE_AUTH ?? "").toLowerCase()
)
const DIST_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../dist"
)

const SAVE_DEBOUNCE_MS = 1200
const ROOM_NAME_RE = /^[A-Za-z0-9_-]{1,64}$/

const MESSAGE_SYNC = 0
const MESSAGE_AWARENESS = 1

// ---------------------------------------------------------------------------
// Rooms
// ---------------------------------------------------------------------------

class Room {
  name: string
  doc = new Y.Doc()
  awareness: awarenessProtocol.Awareness
  conns = new Map<WebSocket, Set<number>>()
  saveTimer: NodeJS.Timeout | null = null
  dirty = false
  saving: Promise<void> = Promise.resolve()

  constructor(name: string) {
    this.name = name
    this.awareness = new awarenessProtocol.Awareness(this.doc)
    this.awareness.setLocalState(null)

    this.doc.on("update", (update: Uint8Array) => {
      const encoder = encoding.createEncoder()
      encoding.writeVarUint(encoder, MESSAGE_SYNC)
      syncProtocol.writeUpdate(encoder, update)
      this.broadcast(encoding.toUint8Array(encoder))
      this.scheduleSave()
    })

    this.awareness.on(
      "update",
      (
        {
          added,
          updated,
          removed,
        }: {
          added: Array<number>
          updated: Array<number>
          removed: Array<number>
        },
        conn: WebSocket | null
      ) => {
        const changed = added.concat(updated, removed)
        if (conn) {
          const ids = this.conns.get(conn)
          if (ids) {
            for (const id of added) ids.add(id)
            for (const id of removed) ids.delete(id)
          }
        }
        const encoder = encoding.createEncoder()
        encoding.writeVarUint(encoder, MESSAGE_AWARENESS)
        encoding.writeVarUint8Array(
          encoder,
          awarenessProtocol.encodeAwarenessUpdate(this.awareness, changed)
        )
        this.broadcast(encoding.toUint8Array(encoder))
      }
    )
  }

  async load() {
    try {
      const rows = await db
        .select({ doc: board.doc })
        .from(board)
        .where(eq(board.id, this.name))
        .limit(1)
      if (rows.length > 0) {
        Y.applyUpdate(this.doc, rows[0].doc)
        return
      }
      // not in Postgres yet — import a legacy DATA_DIR/<id>.yjs file if any
      const legacy = path.join(DATA_DIR, `${this.name}.yjs`)
      if (existsSync(legacy)) {
        Y.applyUpdate(this.doc, new Uint8Array(await readFile(legacy)))
        this.dirty = true
        await this.save()
        console.log(`[room ${this.name}] imported legacy board file`)
      }
    } catch (err) {
      console.error(`[room ${this.name}] failed to load:`, err)
    }
  }

  broadcast(message: Uint8Array) {
    for (const conn of this.conns.keys()) {
      if (conn.readyState === conn.OPEN) {
        conn.send(message, (err) => {
          if (err) this.closeConn(conn)
        })
      }
    }
  }

  scheduleSave() {
    this.dirty = true
    if (this.saveTimer) return
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null
      void this.save()
    }, SAVE_DEBOUNCE_MS)
  }

  save(): Promise<void> {
    if (!this.dirty) return this.saving
    this.dirty = false
    const update = Y.encodeStateAsUpdate(this.doc)
    this.saving = this.saving.then(async () => {
      try {
        await db
          .insert(board)
          .values({ id: this.name, doc: update })
          .onConflictDoUpdate({
            target: board.id,
            set: { doc: update, updatedAt: new Date() },
          })
      } catch (err) {
        console.error(`[room ${this.name}] failed to save:`, err)
        this.dirty = true
      }
    })
    return this.saving
  }

  closeConn(conn: WebSocket) {
    const controlled = this.conns.get(conn)
    if (controlled) {
      this.conns.delete(conn)
      awarenessProtocol.removeAwarenessStates(
        this.awareness,
        [...controlled],
        null
      )
    }
    conn.close()
    if (this.conns.size === 0) {
      if (this.saveTimer) {
        clearTimeout(this.saveTimer)
        this.saveTimer = null
      }
      void this.save().then(() => {
        // unload if still empty after the save completed
        if (this.conns.size === 0 && rooms.get(this.name) === this) {
          rooms.delete(this.name)
          this.awareness.destroy()
          this.doc.destroy()
        }
      })
    }
  }
}

const rooms = new Map<string, Room>()
const roomLoads = new Map<string, Promise<Room>>()

function getRoom(name: string): Promise<Room> {
  const existing = rooms.get(name)
  if (existing) return Promise.resolve(existing)
  let loading = roomLoads.get(name)
  if (!loading) {
    const room = new Room(name)
    loading = room.load().then(() => {
      rooms.set(name, room)
      roomLoads.delete(name)
      return room
    })
    roomLoads.set(name, loading)
  }
  return loading
}

function handleMessage(room: Room, conn: WebSocket, message: Uint8Array) {
  try {
    const decoder = decoding.createDecoder(message)
    const messageType = decoding.readVarUint(decoder)
    switch (messageType) {
      case MESSAGE_SYNC: {
        const encoder = encoding.createEncoder()
        encoding.writeVarUint(encoder, MESSAGE_SYNC)
        syncProtocol.readSyncMessage(decoder, encoder, room.doc, conn)
        if (encoding.length(encoder) > 1) {
          conn.send(encoding.toUint8Array(encoder))
        }
        break
      }
      case MESSAGE_AWARENESS: {
        awarenessProtocol.applyAwarenessUpdate(
          room.awareness,
          decoding.readVarUint8Array(decoder),
          conn
        )
        break
      }
    }
  } catch (err) {
    console.error(`[room ${room.name}] message error:`, err)
  }
}

function setupConnection(
  conn: WebSocket,
  room: Room,
  earlyMessages: Array<Uint8Array>
) {
  room.conns.set(conn, new Set())

  conn.on("message", (data: ArrayBuffer) =>
    handleMessage(room, conn, new Uint8Array(data))
  )

  // liveness ping/pong
  let alive = true
  conn.on("pong", () => {
    alive = true
  })
  const pingInterval = setInterval(() => {
    if (!room.conns.has(conn)) {
      clearInterval(pingInterval)
      return
    }
    if (!alive) {
      room.closeConn(conn)
      clearInterval(pingInterval)
      return
    }
    alive = false
    try {
      conn.ping()
    } catch {
      room.closeConn(conn)
      clearInterval(pingInterval)
    }
  }, 30000)

  conn.on("close", () => {
    room.closeConn(conn)
    clearInterval(pingInterval)
  })

  // messages that arrived while the room was still loading from disk
  for (const message of earlyMessages) {
    handleMessage(room, conn, message)
  }

  // initial handshake: sync step 1 + current awareness states
  {
    const encoder = encoding.createEncoder()
    encoding.writeVarUint(encoder, MESSAGE_SYNC)
    syncProtocol.writeSyncStep1(encoder, room.doc)
    conn.send(encoding.toUint8Array(encoder))

    const states = room.awareness.getStates()
    if (states.size > 0) {
      const awarenessEncoder = encoding.createEncoder()
      encoding.writeVarUint(awarenessEncoder, MESSAGE_AWARENESS)
      encoding.writeVarUint8Array(
        awarenessEncoder,
        awarenessProtocol.encodeAwarenessUpdate(room.awareness, [
          ...states.keys(),
        ])
      )
      conn.send(encoding.toUint8Array(awarenessEncoder))
    }
  }
}

// ---------------------------------------------------------------------------
// HTTP: health + static client
// ---------------------------------------------------------------------------

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
  ".webmanifest": "application/manifest+json",
  ".map": "application/json",
}

function serveFile(res: http.ServerResponse, filePath: string) {
  const ext = path.extname(filePath).toLowerCase()
  const immutable = filePath.includes(`${path.sep}assets${path.sep}`)
  res.writeHead(200, {
    "content-type": MIME_TYPES[ext] ?? "application/octet-stream",
    "cache-control": immutable
      ? "public, max-age=31536000, immutable"
      : "no-cache",
  })
  createReadStream(filePath).pipe(res)
}

const authHandler = toNodeHandler(auth)

// -------------------------------------------------------------------------
// /api/boards — the signed-in user's recent boards
// -------------------------------------------------------------------------

function sendJson(res: http.ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "content-type": "application/json" })
  res.end(JSON.stringify(body))
}

/** Board name as stored in the Yjs doc (meta.name), without keeping the doc. */
function boardName(id: string, docBytes: Uint8Array | null): string {
  const open = rooms.get(id)
  if (open) return open.doc.getMap<string>("meta").get("name") ?? ""
  if (!docBytes) return ""
  const doc = new Y.Doc()
  try {
    Y.applyUpdate(doc, docBytes)
    return doc.getMap<string>("meta").get("name") ?? ""
  } catch {
    return ""
  } finally {
    doc.destroy()
  }
}

async function handleBoardsApi(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  pathname: string
) {
  // cookie-authenticated mutations: only accept same-site browsers (CSRF)
  const origin = req.headers.origin
  if (origin && req.method !== "GET") {
    const originHost = URL.canParse(origin) ? new URL(origin).host : ""
    const ok =
      originHost === req.headers.host || TRUSTED_ORIGINS.includes(origin)
    if (!ok) {
      sendJson(res, 403, { error: "cross-origin request rejected" })
      return
    }
  }

  const session = await auth.api
    .getSession({ headers: fromNodeHeaders(req.headers) })
    .catch(() => null)
  if (!session) {
    sendJson(res, 401, { error: "not signed in" })
    return
  }
  const userId = session.user.id

  if (pathname === "/api/boards" && req.method === "GET") {
    const rows = await db
      .select({
        boardId: userBoard.boardId,
        at: userBoard.lastOpenedAt,
        doc: board.doc,
      })
      .from(userBoard)
      .leftJoin(board, eq(board.id, userBoard.boardId))
      .where(eq(userBoard.userId, userId))
      .orderBy(desc(userBoard.lastOpenedAt))
      .limit(50)
    sendJson(
      res,
      200,
      rows.map((r) => ({
        id: r.boardId,
        name: boardName(r.boardId, r.doc),
        at: r.at.getTime(),
      }))
    )
    return
  }

  const match = /^\/api\/boards\/([A-Za-z0-9_-]{1,64})(\/touch)?$/.exec(
    pathname
  )
  if (match) {
    const boardId = match[1]
    if (match[2] && req.method === "POST") {
      await db
        .insert(userBoard)
        .values({ userId, boardId })
        .onConflictDoUpdate({
          target: [userBoard.userId, userBoard.boardId],
          set: { lastOpenedAt: new Date() },
        })
      sendJson(res, 200, { ok: true })
      return
    }
    if (!match[2] && req.method === "DELETE") {
      await db
        .delete(userBoard)
        .where(
          and(eq(userBoard.userId, userId), eq(userBoard.boardId, boardId))
        )
      sendJson(res, 200, { ok: true })
      return
    }
  }

  sendJson(res, 404, { error: "not found" })
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost")
  const pathname = decodeURIComponent(url.pathname)

  if (pathname.startsWith("/api/auth/")) {
    void authHandler(req, res)
    return
  }

  if (pathname === "/api/boards" || pathname.startsWith("/api/boards/")) {
    handleBoardsApi(req, res, pathname).catch((err) => {
      console.error("[boards api] error:", err)
      if (!res.headersSent) sendJson(res, 500, { error: "internal error" })
    })
    return
  }

  if (pathname === "/api/config") {
    res.writeHead(200, { "content-type": "application/json" })
    res.end(JSON.stringify({ requireAuth: REQUIRE_AUTH }))
    return
  }

  if (pathname === "/healthz") {
    res.writeHead(200, { "content-type": "application/json" })
    res.end(JSON.stringify({ ok: true, rooms: rooms.size }))
    return
  }

  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405).end()
    return
  }

  if (!existsSync(DIST_DIR)) {
    res.writeHead(503, { "content-type": "text/plain" })
    res.end(
      "Client not built. Run `pnpm build` first (dev uses vite on :3000)."
    )
    return
  }

  // resolve inside dist only
  const safePath = path.normalize(pathname).replace(/^(\.\.[/\\])+/, "")
  let filePath = path.join(DIST_DIR, safePath)
  if (!filePath.startsWith(DIST_DIR)) {
    res.writeHead(403).end()
    return
  }
  if (!existsSync(filePath) || statSync(filePath).isDirectory()) {
    // SPA fallback
    filePath = path.join(DIST_DIR, "index.html")
  }
  serveFile(res, filePath)
})

// ---------------------------------------------------------------------------
// WebSocket upgrade
// ---------------------------------------------------------------------------

const wss = new WebSocketServer({ noServer: true })

server.on("upgrade", (req, socket: Duplex, head) => {
  const url = new URL(req.url ?? "/", "http://localhost")
  const match = /^\/sync\/(.+)$/.exec(url.pathname)
  const roomName = match ? decodeURIComponent(match[1]) : null
  if (!roomName || !ROOM_NAME_RE.test(roomName)) {
    socket.write("HTTP/1.1 400 Bad Request\r\n\r\n")
    socket.destroy()
    return
  }
  void (async () => {
    if (REQUIRE_AUTH) {
      const session = await auth.api
        .getSession({ headers: fromNodeHeaders(req.headers) })
        .catch(() => null)
      if (!session) {
        socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n")
        socket.destroy()
        return
      }
    }
    handleSyncUpgrade(req, socket, head, roomName)
  })()
})

function handleSyncUpgrade(
  req: http.IncomingMessage,
  socket: Duplex,
  head: Buffer,
  roomName: string
) {
  wss.handleUpgrade(req, socket, head, (conn) => {
    // buffer messages that arrive before the room finished loading, so the
    // client's initial SyncStep1 is never dropped
    conn.binaryType = "arraybuffer"
    const early: Array<Uint8Array> = []
    const buffer = (data: ArrayBuffer) => early.push(new Uint8Array(data))
    conn.on("message", buffer)
    void getRoom(roomName).then((room) => {
      conn.off("message", buffer)
      if (
        conn.readyState === conn.OPEN ||
        conn.readyState === conn.CONNECTING
      ) {
        setupConnection(conn, room, early)
      }
    })
  })
}

// ---------------------------------------------------------------------------
// Startup / shutdown
// ---------------------------------------------------------------------------

await migrate(db, {
  migrationsFolder: path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "drizzle"
  ),
})

function onListening(host: string) {
  console.log(`kritzlboard server listening on http://${host}:${PORT}`)
  console.log(`  sync endpoint: ws://${host}:${PORT}/sync/<boardId>`)
  console.log(
    `  auth:          /api/auth/* (boards ${REQUIRE_AUTH ? "require sign-in" : "open to everyone"})`
  )
  console.log(
    existsSync(DIST_DIR)
      ? `  serving app:   ${DIST_DIR}`
      : `  app not built yet (dist/ missing) — sync only`
  )
}

// "::" listens dual-stack (IPv4 + IPv6); fall back to IPv4-only where
// IPv6 is unavailable
server.once("error", (err: NodeJS.ErrnoException) => {
  if (
    HOST === "::" &&
    (err.code === "EAFNOSUPPORT" || err.code === "EADDRNOTAVAIL")
  ) {
    server.listen(PORT, "0.0.0.0", () => onListening("0.0.0.0"))
  } else {
    throw err
  }
})
server.listen(PORT, HOST, () => onListening(HOST))

let shuttingDown = false
async function shutdown() {
  if (shuttingDown) return
  shuttingDown = true
  console.log("shutting down, saving boards…")
  await Promise.all([...rooms.values()].map((room) => room.save()))
  await pool.end()
  process.exit(0)
}

process.on("SIGINT", () => void shutdown())
process.on("SIGTERM", () => void shutdown())
