/**
 * Adapts Node's built-in `node:sqlite` (DatabaseSync) to the callback shape
 * Drizzle's `sqlite-proxy` driver expects. This exists so the project needs
 * zero native/compiled dependencies -- no node-gyp, no Python, no Visual
 * Studio Build Tools on Windows. `better-sqlite3` was tried first and
 * dropped: it needs a prebuilt binary matching the exact Node version, and
 * on a new enough Node release (no matching prebuild yet) it falls back to
 * compiling from source, which most machines aren't set up for.
 *
 * `node:sqlite` is still flagged experimental by Node, but it's part of
 * Node core -- nothing to install, nothing to compile.
 */
import { DatabaseSync, type StatementSync } from "node:sqlite";
import type { AsyncRemoteCallback } from "drizzle-orm/sqlite-proxy";

export function createNodeSqliteCallback(db: DatabaseSync): AsyncRemoteCallback {
  const statementCache = new Map<string, StatementSync>();

  function getStatement(sql: string): StatementSync {
    let stmt = statementCache.get(sql);
    if (!stmt) {
      stmt = db.prepare(sql);
      statementCache.set(sql, stmt);
    }
    return stmt;
  }

  return async (sql, params, method) => {
    const stmt = getStatement(sql);

    if (method === "run") {
      stmt.run(...params);
      return { rows: [] };
    }

    if (method === "get") {
      const row = stmt.get(...params) as Record<string, unknown> | undefined;
      return { rows: row ? Object.values(row) : [] };
    }

    // "all" and "values" both want every matching row, as an array of
    // positional value-arrays (drizzle maps these back to columns itself
    // using the query's known field order).
    const rows = stmt.all(...params) as Record<string, unknown>[];
    return { rows: rows.map((row) => Object.values(row)) };
  };
}
