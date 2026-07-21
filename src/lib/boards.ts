// server-side "my boards" list for signed-in users (anonymous visitors use
// the localStorage recents in user.ts instead)
import type { RecentBoard } from "./user"

export async function fetchMyBoards(): Promise<Array<RecentBoard>> {
  const res = await fetch("/api/boards")
  if (!res.ok) throw new Error(`boards: ${res.status}`)
  return (await res.json()) as Array<RecentBoard>
}

export function touchBoardOnServer(id: string) {
  void fetch(`/api/boards/${encodeURIComponent(id)}/touch`, {
    method: "POST",
  }).catch(() => {
    // offline — the board will be recorded on the next visit
  })
}

export async function removeBoardOnServer(id: string) {
  await fetch(`/api/boards/${encodeURIComponent(id)}`, {
    method: "DELETE",
  }).catch(() => {})
}
