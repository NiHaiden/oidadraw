import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { db } from "./db.ts"
import * as schema from "./schema.ts"

if (!process.env.BETTER_AUTH_SECRET && process.env.NODE_ENV === "production") {
  console.warn(
    "[auth] BETTER_AUTH_SECRET is not set — using an insecure default. " +
      "Set it to a long random string in production."
  )
}

export const TRUSTED_ORIGINS = [
  // vite dev server (the client proxies /api there but keeps its origin)
  "http://localhost:3000",
  ...(process.env.TRUSTED_ORIGINS?.split(",").filter(Boolean) ?? []),
]

export const auth = betterAuth({
  // when unset, BetterAuth derives the base URL from the incoming request,
  // which is what we want for a self-hosted app served from one origin
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, { provider: "pg", schema }),
  emailAndPassword: { enabled: true },
  trustedOrigins: TRUSTED_ORIGINS,
})
