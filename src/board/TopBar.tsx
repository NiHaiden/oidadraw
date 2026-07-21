import { useEffect, useState } from "react"
import { Link, useNavigate } from "@tanstack/react-router"
import { Popover } from "radix-ui"
import { Check, Link as LinkIcon, LogOut } from "lucide-react"
import { useBoardName, useConnectionStatus, usePeers } from "./store"
import { getUser, setUserName, touchRecentBoard } from "@/lib/user"
import { touchBoardOnServer } from "@/lib/boards"
import { signOut, useSession } from "@/lib/auth-client"
import { cn } from "@/lib/utils"
import type { BoardStore } from "./store"
import type { UserInfo } from "./types"

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

function Avatar({ user, title }: { user: UserInfo; title?: string }) {
  return (
    <span
      title={title ?? user.name}
      className="flex size-7 items-center justify-center rounded-full text-[10px] font-semibold text-white ring-2 ring-white"
      style={{ backgroundColor: user.color }}
    >
      {initials(user.name)}
    </span>
  )
}

export function TopBar({ store }: { store: BoardStore }) {
  const navigate = useNavigate()
  const name = useBoardName(store)
  const peers = usePeers(store)
  const status = useConnectionStatus(store)
  const { data: session, isPending } = useSession()
  const [me, setMe] = useState<UserInfo>(getUser)
  const [copied, setCopied] = useState(false)

  // record the visit: on the account while signed in, in localStorage when
  // anonymous — signed-in boards must not leak into the logged-out list
  const signedIn = !!session
  useEffect(() => {
    if (isPending || !signedIn) return
    touchBoardOnServer(store.boardId)
  }, [store, signedIn, isPending])
  useEffect(() => {
    if (isPending || signedIn) return
    touchRecentBoard(store.boardId, name)
  }, [store, name, signedIn, isPending])

  // while signed in, presence shows the account name
  useEffect(() => {
    const accountName = session?.user.name
    if (accountName && accountName !== getUser().name) {
      const user = setUserName(accountName)
      setMe(user)
      store.setUser(user)
    }
  }, [session?.user.name, store])

  const copyLink = () => {
    navigator.clipboard.writeText(location.href).then(
      () => {
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      },
      () => {
        // clipboard unavailable (e.g. non-secure context); show the URL
        window.prompt("Copy this link:", location.href)
      }
    )
  }

  return (
    <>
      <div className="absolute top-3 left-3 flex items-center gap-2 rounded-xl border border-border bg-white p-1.5 pl-3 shadow-lg">
        <Link
          to="/"
          className="text-sm font-bold tracking-tight text-neutral-900 hover:text-blue-600"
          title="All boards"
        >
          kritzlboard
        </Link>
        <div className="h-5 w-px bg-border" />
        <input
          className="w-44 rounded-md px-2 py-1 text-sm outline-none hover:bg-neutral-50 focus:bg-neutral-100"
          placeholder="Untitled board"
          value={name}
          onChange={(e) => store.setBoardName(e.target.value)}
        />
      </div>

      <div className="absolute top-3 right-3 flex items-center gap-3 rounded-xl border border-border bg-white p-1.5 shadow-lg">
        <span
          className="ml-1.5 flex items-center gap-1.5 text-xs text-neutral-500"
          title={
            status === "connected"
              ? "Connected to sync server"
              : status === "connecting"
                ? "Connecting…"
                : "Offline — changes sync when reconnected"
          }
        >
          <span
            className={cn(
              "size-2 rounded-full",
              status === "connected"
                ? "bg-emerald-500"
                : status === "connecting"
                  ? "bg-amber-400"
                  : "bg-red-500"
            )}
          />
          {status === "connected"
            ? "Online"
            : status === "connecting"
              ? "Connecting"
              : "Offline"}
        </span>

        <div className="flex items-center -space-x-1.5">
          {peers.slice(0, 5).map((peer) => (
            <Avatar key={peer.clientId} user={peer.user} />
          ))}
          {peers.length > 5 && (
            <span className="flex size-7 items-center justify-center rounded-full bg-neutral-200 text-[10px] font-semibold text-neutral-600 ring-2 ring-white">
              +{peers.length - 5}
            </span>
          )}
          <Popover.Root>
            <Popover.Trigger asChild>
              <button title={`You: ${me.name} — click to rename`}>
                <Avatar user={me} title={`You: ${me.name}`} />
              </button>
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content
                sideOffset={8}
                align="end"
                className="z-50 w-56 rounded-xl border border-border bg-white p-3 shadow-lg"
              >
                <div className="mb-1.5 text-[11px] font-medium text-neutral-500">
                  Your name
                </div>
                <input
                  className="w-full rounded-md border border-border px-2 py-1.5 text-sm outline-none focus:border-blue-500"
                  value={me.name}
                  onChange={(e) => {
                    const user = setUserName(e.target.value)
                    setMe(user)
                    store.setUser(user)
                  }}
                />
                <div className="mt-3 border-t border-border pt-2.5">
                  {session ? (
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className="truncate text-xs text-neutral-500"
                        title={session.user.email}
                      >
                        {session.user.email}
                      </span>
                      <button
                        className="flex shrink-0 items-center gap-1 text-xs font-medium text-neutral-500 hover:text-neutral-900"
                        onClick={() => void signOut()}
                      >
                        <LogOut className="size-3.5" />
                        Sign out
                      </button>
                    </div>
                  ) : (
                    <button
                      className="text-xs font-medium text-blue-600 hover:text-blue-700"
                      onClick={() =>
                        navigate({
                          to: "/login",
                          search: { redirect: `/b/${store.boardId}` },
                        })
                      }
                    >
                      Sign in
                    </button>
                  )}
                </div>
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
        </div>

        <button
          className="flex h-8 items-center gap-1.5 rounded-lg bg-blue-600 px-3 text-xs font-medium text-white hover:bg-blue-700"
          onClick={copyLink}
        >
          {copied ? (
            <Check className="size-3.5" />
          ) : (
            <LinkIcon className="size-3.5" />
          )}
          {copied ? "Copied!" : "Share"}
        </button>
      </div>
    </>
  )
}
