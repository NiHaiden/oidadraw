import { drizzle } from "drizzle-orm/node-postgres"
import pg from "pg"
import * as schema from "./schema.ts"

const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgres://kritzlboard:kritzlboard@localhost:5432/kritzlboard"

export const pool = new pg.Pool({ connectionString: DATABASE_URL })
export const db = drizzle(pool, { schema })
