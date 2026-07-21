/**
 * Drizzle schema for everything kritzlboard stores in Postgres:
 * BetterAuth tables (generated, see auth-schema.ts) and board documents.
 */
import {
  customType,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core"
import { user } from "./auth-schema.ts"

export * from "./auth-schema.ts"

/** Yjs document snapshot, stored as a single binary update. */
const bytea = customType<{ data: Uint8Array; driverData: Buffer }>({
  dataType() {
    return "bytea"
  },
  toDriver(value) {
    return Buffer.isBuffer(value) ? value : Buffer.from(value)
  },
  fromDriver(value) {
    return new Uint8Array(value)
  },
})

export const board = pgTable("board", {
  id: text("id").primaryKey(),
  doc: bytea("doc").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

// which boards a signed-in user has opened ("my boards" on the home page);
// no FK to board.id — the board row only appears on the first debounced save
export const userBoard = pgTable(
  "user_board",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    boardId: text("board_id").notNull(),
    lastOpenedAt: timestamp("last_opened_at").defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.boardId] })]
)
