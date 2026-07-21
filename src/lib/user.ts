import type { UserInfo } from "@/board/types"

const USER_KEY = "oidadraw:user"

const CURSOR_COLORS = [
  "#e03131",
  "#e16919",
  "#e0a300",
  "#099268",
  "#0e98ad",
  "#3667e8",
  "#7048c6",
  "#c2255c",
]

const ADJECTIVES = [
  "Brave",
  "Calm",
  "Clever",
  "Eager",
  "Gentle",
  "Happy",
  "Keen",
  "Lively",
  "Mighty",
  "Nimble",
  "Quick",
  "Swift",
]

const ANIMALS = [
  "Alpaca",
  "Badger",
  "Chamois",
  "Fox",
  "Ibex",
  "Lynx",
  "Marmot",
  "Otter",
  "Owl",
  "Stag",
  "Trout",
  "Wolf",
]

function pick<T>(list: Array<T>): T {
  return list[Math.floor(Math.random() * list.length)]
}

export function getUser(): UserInfo {
  try {
    const raw = localStorage.getItem(USER_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as UserInfo
      if (parsed.name && parsed.color) return parsed
    }
  } catch {
    // fall through to a fresh identity
  }
  const user: UserInfo = {
    name: `${pick(ADJECTIVES)} ${pick(ANIMALS)}`,
    color: pick(CURSOR_COLORS),
  }
  try {
    localStorage.setItem(USER_KEY, JSON.stringify(user))
  } catch {
    // private mode etc. — identity just won't persist
  }
  return user
}

export function setUserName(name: string): UserInfo {
  const user = { ...getUser(), name: name.trim() || getUser().name }
  try {
    localStorage.setItem(USER_KEY, JSON.stringify(user))
  } catch {
    // ignore
  }
  return user
}

export interface RecentBoard {
  id: string
  name: string
  at: number
}

const RECENTS_KEY = "oidadraw:recents"

export function getRecentBoards(): Array<RecentBoard> {
  try {
    const raw = localStorage.getItem(RECENTS_KEY)
    if (raw) return JSON.parse(raw) as Array<RecentBoard>
  } catch {
    // corrupted — start over
  }
  return []
}

export function touchRecentBoard(id: string, name: string) {
  const rest = getRecentBoards().filter((b) => b.id !== id)
  const next = [{ id, name, at: Date.now() }, ...rest].slice(0, 24)
  try {
    localStorage.setItem(RECENTS_KEY, JSON.stringify(next))
  } catch {
    // ignore
  }
}

export function removeRecentBoard(id: string) {
  const next = getRecentBoards().filter((b) => b.id !== id)
  try {
    localStorage.setItem(RECENTS_KEY, JSON.stringify(next))
  } catch {
    // ignore
  }
}
