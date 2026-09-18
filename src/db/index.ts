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
// to do that, so without a generous busy_timeout the loser of that race gets
// an immediate "database is locked" error instead of just waiting its turn.
// 5s was occasionally too short once more routes joined the build's import
// graph and more workers piled up at once; 30s costs nothing in practice
// (actual waits are normally milliseconds) but gives everyone room to queue.
sqlite.exec("PRAGMA busy_timeout = 30000");
try {
  sqlite.exec("PRAGMA journal_mode = WAL");
} catch (err) {
  // Switching journal mode to WAL needs a brief moment of exclusive access,
  // and in practice that doesn't wait for busy_timeout the way ordinary
  // reads/writes do -- on Railway's build machine, with 30+ worker processes
  // each importing this module at once purely to collect route metadata (no
  // real queries), that exclusive moment is contested enough to fail outright
  // instead of queueing. It's harmless to lose that race: WAL mode is stored
  // in the database file itself, so once any one worker succeeds, the file
  // stays in WAL mode for everyone else too, and a worker that loses the race
  // just carries on in whatever journal mode is already active -- it doesn't
  // need WAL for a build step that never touches real data.
  console.warn("Could not switch SQLite to WAL mode (safe to ignore during build):", err);
}
sqlite.exec("PRAGMA foreign_keys = ON");

export const db = drizzle(createNodeSqliteCallback(sqlite), { schema });
