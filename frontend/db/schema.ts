import { sql } from "drizzle-orm";
import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    authProvider: text("auth_provider").notNull().default("sites"),
    email: text("email").notNull(),
    displayName: text("display_name").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [uniqueIndex("idx_users_email").on(table.email)],
);

export const joins = sqliteTable(
  "joins",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    keyword: text("keyword").notNull().default("기타"),
    location: text("location").notNull(),
    scheduledAt: integer("scheduled_at", { mode: "timestamp" }).notNull(),
    maxParticipants: integer("max_participants").notNull(),
    status: text("status").notNull().default("모집중"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [uniqueIndex("idx_joins_owner_title").on(table.ownerId, table.title)],
);

export const joinParticipants = sqliteTable(
  "join_participants",
  {
    joinId: integer("join_id")
      .notNull()
      .references(() => joins.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("신청"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [
    uniqueIndex("idx_join_participants_join_user").on(
      table.joinId,
      table.userId,
    ),
  ],
);

