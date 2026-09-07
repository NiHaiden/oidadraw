import { spawnSync } from "node:child_process"
import { existsSync } from "node:fs"
import { loadEnvFile } from "node:process"
import concurrently from "concurrently"

// Share local configuration with both processes. Exported variables take priority.
if (existsSync(".env")) loadEnvFile(".env")
process.env.NODE_ENV ??= "development"
process.env.PORT ??= "3001"

if (!process.env.DATABASE_URL) {
  console.log("[dev] Starting development Postgres…")
  const database = spawnSync(
    "docker",
    [
      "compose",
      "-f",
      "docker-compose.dev.yml",
      "up",
      "-d",
      "--wait",
      "--wait-timeout",
      "60",
    ],
    { stdio: "inherit" }
  )
  if (database.error || database.status !== 0) {
    console.error(
      "[dev] Could not start Postgres. Start Docker Desktop or OrbStack and retry pnpm dev.\n" +
        "      To use an existing database, set DATABASE_URL in .env."
    )
    process.exit(1)
  }
  process.env.DATABASE_URL =
    "postgres://kritzlboard:kritzlboard@localhost:5441/kritzlboard"
}

console.log("[dev] App: http://localhost:3000")
console.log(
  "[dev] Ctrl+C stops the app. Postgres stays available (pnpm db:down to stop it)."
)

const { result } = concurrently(
  [
    { command: "pnpm dev:web", name: "web", prefixColor: "cyan" },
    { command: "pnpm dev:sync", name: "sync", prefixColor: "magenta" },
  ],
  { killOthersOn: ["success", "failure"], killTimeout: 5000 }
)

try {
  await result
} catch {
  process.exitCode = 1
}
