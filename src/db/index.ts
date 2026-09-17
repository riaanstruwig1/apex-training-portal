// Note: deliberately no `import "server-only"` here -- this module is also
// loaded directly by the seed script via `tsx`, outside Next's bundler,
// where the server-only guard throws unconditionally. It's never imported
// from a "use client" file, so the guard isn't needed at runtime.
import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import * as schema from "./schema";
import { createNodeSqliteCallback } from "./node-sqlite-proxy";

// Single shared connection. SQLite is file-based and fine at this scale
// (a single DTO's worth of students); see README for the Postgres swap
// path if the school outgrows it.
const sqlite = new DatabaseSync(process.env.DATABASE_URL ?? "./data/apex-portal.db");
sqlite.exec("PRAGMA busy_timeout = 5000");
sqlite.exec("PRAGMA journal_mode = WAL");
sqlite.exec("PRAGMA foreign_keys = ON");

export const db = drizzle(createNodeSqliteCallback(sqlite), { schema });
