import { createAuthClient } from "better-auth/react"

// same-origin: served by server/main.ts in production, proxied by vite in dev
export const authClient = createAuthClient()

export const { signIn, signUp, signOut, useSession } = authClient

export interface ServerConfig {
  requireAuth: boolean
}

export async function getServerConfig(): Promise<ServerConfig> {
  try {
    const res = await fetch("/api/config")
    if (!res.ok) throw new Error(`config: ${res.status}`)
    return (await res.json()) as ServerConfig
  } catch {
    // server unreachable or older version — behave like an open instance
    return { requireAuth: false }
  }
}
