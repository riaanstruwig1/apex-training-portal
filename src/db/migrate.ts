/**
 * Applies pending migrations from ./drizzle to the SQLite database.
 *
 * We can't use `drizzle-kit migrate` directly -- it insists on connecting
 * via `better-sqlite3` or `@libsql/client`, both of which need a native
 * binary. This project intentionally avoids that (see node-sqlite-proxy.ts)
 * so instead we drive drizzle-orm's own proxy migrator, which just needs a
 * callback that can run raw SQL -- same as the app's query driver.
 *
 * Run with: npm run db:migrate
 */
import "dotenv/config";
import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import { migrate } from "drizzle-orm/sqlite-proxy/migrator";
import { createNodeSqliteCallback } from "./node-sqlite-proxy";

async function main() {
  const dbPath = process.env.DATABASE_URL ?? "./data/apex-portal.db";
  const sqlite = new DatabaseSync(dbPath);
  const db = drizzle(createNodeSqliteCallback(sqlite));

  await migrate(
    db,
    async (queries) => {
      for (const query of queries) {
        sqlite.exec(query);
      }
    },
    { migrationsFolder: "./drizzle" }
  );

  console.log(`Migrations applied to ${dbPath}`);
  sqlite.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
