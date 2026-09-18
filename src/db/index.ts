// Note: deliberately no `import "server-only"` here -- this module is also
// loaded directly by the seed script via `tsx`, outside Next's bundler,
// where the server-only guard throws unconditionally. It's never imported
// from a "use client" file, so the guard isn't needed at runtime.
import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import { mkdirSync } from "node:fs";
import path from "node:path";
import * as schema from "./schema";
import { createNodeSqliteCallback } from "./node-sqlite-proxy";

// Single shared connection. SQLite is file-based and fine at this scale
// (a single DTO's worth of students); see README for the Postgres swap
// path if the school outgrows it.
const dbPath = process.env.DATABASE_URL ?? "./data/apex-portal.db";
// A fresh checkout (e.g. Next's production build, run against a clean
// clone from GitHub) has no `data/` folder yet -- SQLite won't create a
// missing parent directory for you, it just fails with "unable to open
// database file". Make sure the folder exists first.
mkdirSync(path.dirname(dbPath), { recursive: true });
const sqlite = new DatabaseSync(dbPath);
// Next's production build evaluates every route module (including this one)
// across several parallel worker processes while collecting page data. Each
// worker opens its own connection to the same file and tries to switch it to
// WAL mode at roughly the same moment; SQLite briefly needs exclusive access
// to do that, so without a busy_timeout the loser of that race gets an
// immediate "database is locked" error instead of just waiting its turn.
sqlite.exec("PRAGMA busy_timeout = 5000");
sqlite.exec("PRAGMA journal_mode = WAL");
sqlite.exec("PRAGMA foreign_keys = ON");

export const db = drizzle(createNodeSqliteCallback(sqlite), { schema });