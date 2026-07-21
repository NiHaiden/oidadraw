import { useEffect, useState } from "react"
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router"
import { nanoid } from "nanoid"
import { LogOut, Plus, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getRecentBoards, removeRecentBoard, setUserName } from "@/lib/user"
import { fetchMyBoards, removeBoardOnServer } from "@/lib/boards"
import { signOut, useSession } from "@/lib/auth-client"
import type { RecentBoard } from "@/lib/user"

export const Route = createFileRoute("/")({ component: Home })

function timeAgo(ts: number): string {
  const mins = Math.floor((Date.now() - ts) / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins} min ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} h ago`
  const days = Math.floor(hours / 24)
  return `${days} d ago`
}

function AccountCorner() {
  const { data: session, isPending } = useSession()

  if (isPending) return <div className="h-8" />
  if (!session) {
    return (
      <Link
        to="/login"
        className="text-sm font-medium text-neutral-500 hover:text-neutral-900"
      >
        Sign in
      </Link>
    )
  }
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="text-neutral-500">
        Signed in as{" "}
        <span className="font-medium text-neutral-900">
          {session.user.name}
        </span>
      </span>
      <button
        className="flex items-center gap-1 text-neutral-500 hover:text-neutral-900"
        title="Sign out"
        onClick={() => void signOut()}
      >
        <LogOut className="size-4" />
        Sign out
      </button>
    </div>
  )
}

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
    <main className="mx-auto min-h-svh max-w-3xl px-6 py-16">
      <div className="mb-8 flex justify-end">
        <AccountCorner />
      </div>
      <header className="mb-12">
        <h1 className="text-3xl font-bold tracking-tight">kritzlboard</h1>
        <p className="mt-2 text-neutral-500">
          A collaborative whiteboard you can host yourself. Create a board and
          share the link — everyone on it draws together in real time.
        </p>
        <Button className="mt-6" size="lg" onClick={createBoard}>
          <Plus data-icon="inline-start" />
          New board
        </Button>
      </header>

      {recents.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-neutral-500 uppercase">
            Recent boards
          </h2>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {recents.map((board) => (
              <li key={board.id} className="group relative">
                <Link
                  to="/b/$boardId"
                  params={{ boardId: board.id }}
                  className="block rounded-xl border border-border bg-white p-4 pr-10 transition-colors hover:border-blue-400 hover:shadow-sm"
                >
                  <div className="truncate font-medium">
                    {board.name || "Untitled board"}
                  </div>
                  <div className="mt-1 text-xs text-neutral-400">
                    {timeAgo(board.at)}
                  </div>
                </Link>
                <button
                  className="absolute top-3 right-3 hidden rounded-md p-1 text-neutral-400 group-hover:block hover:bg-neutral-100 hover:text-neutral-700"
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
  )
}
