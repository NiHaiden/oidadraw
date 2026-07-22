import { useEffect, useState } from "react"
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router"
import { nanoid } from "nanoid"
import { Clock, LogOut, PenLine, Plus, Server, Users, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getRecentBoards, removeRecentBoard, setUserName } from "@/lib/user"
import { fetchMyBoards, removeBoardOnServer } from "@/lib/boards"
import { signOut, useSession } from "@/lib/auth-client"
import type { RecentBoard } from "@/lib/user"

export const Route = createFileRoute("/")({ component: Home })

// whiteboard marker colors used for small decorative accents
const MARKERS = ["#3b82f6", "#ef4444", "#22c55e", "#f59e0b", "#8b5cf6"]

function markerFor(id: string): string {
  let sum = 0
  for (const ch of id) sum += ch.charCodeAt(0)
  return MARKERS[sum % MARKERS.length]
}

function timeAgo(ts: number): string {
  const mins = Math.floor((Date.now() - ts) / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins} min ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} h ago`
  const days = Math.floor(hours / 24)
  return `${days} d ago`
}

function Squiggle({ color, className }: { color: string; className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 44 10"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M2 7 C 8 2, 14 9, 21 5 S 34 2, 42 6"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

function AccountCorner() {
  const { data: session, isPending } = useSession()

  if (isPending) return <div className="h-8" />
  if (!session) {
    return (
      <Button variant="outline" size="sm" asChild>
        <Link to="/login">Sign in</Link>
      </Button>
    )
  }
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="hidden text-muted-foreground sm:inline">
        Signed in as{" "}
        <span className="font-medium text-foreground">{session.user.name}</span>
      </span>
      <Button variant="ghost" size="sm" onClick={() => void signOut()}>
        <LogOut data-icon="inline-start" />
        Sign out
      </Button>
    </div>
  )
}

const FEATURES = [
  {
    icon: Users,
    color: MARKERS[0],
    title: "Together in real time",
    text: "Live cursors and strokes from everyone on the board, as they happen.",
  },
  {
    icon: PenLine,
    color: MARKERS[2],
    title: "Zero setup",
    text: "One click and your board is live. No account needed to start drawing.",
  },
  {
    icon: Server,
    color: MARKERS[3],
    title: "Yours to host",
    text: "Run it on your own server and keep your sketches to yourself.",
  },
]

function Home() {
  const { data: session, isPending } = useSession()

  // presence identity follows the account while signed in
  useEffect(() => {
    if (session?.user.name) setUserName(session.user.name)
  }, [session?.user.name])

  const navigate = useNavigate()
  const signedIn = !!session
  const [recents, setRecents] = useState<Array<RecentBoard>>([])

  // signed out: only this device's anonymous boards. signed in: the account's
  // boards (server-side) plus anonymous ones from this device.
  useEffect(() => {
    if (isPending) return
    if (!signedIn) {
      setRecents(getRecentBoards())
      return
    }
    let cancelled = false
    fetchMyBoards()
      .then((mine) => {
        if (cancelled) return
        const seen = new Set(mine.map((b) => b.id))
        const merged = [
          ...mine,
          ...getRecentBoards().filter((b) => !seen.has(b.id)),
        ]
        merged.sort((a, b) => b.at - a.at)
        setRecents(merged)
      })
      .catch(() => {
        if (!cancelled) setRecents(getRecentBoards())
      })
    return () => {
      cancelled = true
    }
  }, [signedIn, isPending])

  const removeBoard = (id: string) => {
    removeRecentBoard(id)
    if (signedIn) void removeBoardOnServer(id)
    setRecents((prev) => prev.filter((b) => b.id !== id))
  }

  const createBoard = () => {
    navigate({ to: "/b/$boardId", params: { boardId: nanoid(10) } })
  }

  return (
    <div className="relative min-h-svh">
      {/* dotted whiteboard-canvas backdrop, fading out toward the bottom */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[34rem] bg-[radial-gradient(var(--border)_1px,transparent_1px)] [mask-image:linear-gradient(to_bottom,black,transparent)] [background-size:22px_22px]"
        aria-hidden="true"
      />

      <main className="relative mx-auto max-w-4xl px-6 pt-8 pb-24">
        <nav className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <PenLine className="size-4" />
            </span>
            <span className="text-lg font-bold tracking-tight">
              kritzlboard
            </span>
          </div>
          <AccountCorner />
        </nav>

        <header className="mt-20 sm:mt-28">
          <div className="mb-5 flex gap-1.5" aria-hidden="true">
            {MARKERS.map((color) => (
              <span
                key={color}
                className="size-2 rounded-full"
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
          <h1 className="max-w-2xl text-4xl font-bold tracking-tight text-balance sm:text-5xl">
            Draw it out.{" "}
            <span className="relative inline-block">
              Together.
              <svg
                className="absolute -bottom-1.5 left-0 w-full sm:-bottom-2"
                viewBox="0 0 200 12"
                fill="none"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <path
                  d="M3 8 C 40 2, 80 12, 120 5 S 175 4, 197 8"
                  stroke={MARKERS[0]}
                  strokeWidth="5"
                  strokeLinecap="round"
                />
              </svg>
            </span>
          </h1>
          <p className="mt-6 max-w-xl text-lg text-pretty text-muted-foreground">
            A collaborative whiteboard for quick sketches and messy ideas.
            Create a board, share the link, and everyone draws together in real
            time.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Button size="lg" className="px-4 text-base" onClick={createBoard}>
              <Plus data-icon="inline-start" />
              New board
            </Button>
            <span className="text-sm text-muted-foreground">
              Free · no sign-up needed
            </span>
          </div>
        </header>

        <section className="mt-20 grid grid-cols-1 gap-8 sm:grid-cols-3">
          {FEATURES.map(({ icon: Icon, color, title, text }) => (
            <div key={title}>
              <Icon className="size-5" style={{ color }} />
              <h2 className="mt-3 font-semibold">{title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{text}</p>
            </div>
          ))}
        </section>

        {recents.length > 0 && (
          <section className="mt-20">
            <h2 className="mb-4 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
              Recent boards
            </h2>
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {recents.map((board) => (
                <li key={board.id} className="group relative">
                  <Link
                    to="/b/$boardId"
                    params={{ boardId: board.id }}
                    className="block rounded-xl border border-border bg-card p-4 pr-10 transition-all hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <Squiggle
                      color={markerFor(board.id)}
                      className="h-2.5 w-11"
                    />
                    <div className="mt-2.5 truncate font-medium">
                      {board.name || "Untitled board"}
                    </div>
                    <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="size-3" />
                      {timeAgo(board.at)}
                    </div>
                  </Link>
                  <button
                    className="absolute top-3 right-3 hidden rounded-md p-1 text-muted-foreground group-hover:block hover:bg-muted hover:text-foreground"
                    title="Remove from recent boards"
                    onClick={() => removeBoard(board.id)}
                  >
                    <X className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  )
}
