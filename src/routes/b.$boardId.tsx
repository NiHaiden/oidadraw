import { useEffect, useState } from "react"
import { createFileRoute, redirect } from "@tanstack/react-router"
import { BoardStore } from "@/board/store"
import { Board } from "@/board/Board"
import { authClient, getServerConfig } from "@/lib/auth-client"

export const Route = createFileRoute("/b/$boardId")({
  beforeLoad: async ({ params }) => {
    const config = await getServerConfig()
    if (!config.requireAuth) return
    const { data: session } = await authClient.getSession()
    if (!session) {
      throw redirect({
        to: "/login",
        search: { redirect: `/b/${params.boardId}` },
      })
    }
  },
  component: BoardPage,
})

function BoardPage() {
  const { boardId } = Route.useParams()
  const [store, setStore] = useState<BoardStore | null>(null)

  useEffect(() => {
    const s = new BoardStore(boardId)
    setStore(s)
    return () => {
      setStore(null)
      s.destroy()
    }
  }, [boardId])

  if (!store || store.boardId !== boardId) return null
  return <Board key={store.boardId} store={store} />
}
