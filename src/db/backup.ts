/**
 * Zips the live database + all uploaded files (profile pictures, POP
 * proofs, consent/indemnity docs, everything under data/uploads) into a
 * single dated .zip under data/backups/, then deletes zips older than
 * BACKUP_RETENTION_DAYS (default 30) so this doesn't grow forever.
 *
 * The database runs in WAL mode (see src/db/index.ts), which means the
 * live data can be split across apex-portal.db / -wal / -shm at any given
 * moment -- so this first runs `PRAGMA wal_checkpoint(TRUNCATE)` to fold
 * the WAL back into the main file, giving a single consistent .db file to
 * zip, rather than copying a half-written WAL alongside a stale main file.
 *
 * Run with: npm run db:backup
 *
 * To automate this daily, see the note at the bottom of this file --
 * short version: `0 2 * * * cd /path/to/app && npm run db:backup` in cron
 * once this is hosted somewhere with cron available (Railway/Render both
 * support scheduled jobs; ask Claude to wire it up once you've picked a
 * host). This script only creates the local zip -- copying that zip
 * somewhere OFF the server (so a server problem can't take out the live
 * data and the backup at once) is a separate step, still to be set up.
 */
import "dotenv/config";
import { DatabaseSync } from "node:sqlite";
import { existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from "node:fs";
import path from "node:path";
import { ZipArchive } from "archiver";
import { createWriteStream } from "node:fs";

const DB_PATH = process.env.DATABASE_URL ?? "./data/apex-portal.db";
const UPLOADS_DIR = path.join(process.cwd(), "data", "uploads");
const BACKUPS_DIR = path.join(process.cwd(), "data", "backups");
const RETENTION_DAYS = Number(process.env.BACKUP_RETENTION_DAYS ?? 30);

function timestamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}

async function main() {
  if (!existsSync(DB_PATH)) {
    console.error(`No database found at ${DB_PATH} -- nothing to back up.`);
    process.exit(1);
  }

  // Flush the WAL into the main file so we're zipping one consistent
  // snapshot, not a main file that's missing recent writes.
  const sqlite = new DatabaseSync(DB_PATH);
  sqlite.exec("PRAGMA wal_checkpoint(TRUNCATE)");
  sqlite.close();

  mkdirSync(BACKUPS_DIR, { recursive: true });
  const zipPath = path.join(BACKUPS_DIR, `apex-backup-${timestamp()}.zip`);

  await new Promise<void>((resolve, reject) => {
    const output = createWriteStream(zipPath);
    const archive = new ZipArchive({ zlib: { level: 9 } });
    output.on("close", () => resolve());
    archive.on("error", reject);
    archive.pipe(output);

    archive.file(DB_PATH, { name: "apex-portal.db" });
    if (existsSync(UPLOADS_DIR)) {
      archive.directory(UPLOADS_DIR, "uploads");
    }
    archive.finalize();
  });

  const sizeMb = (statSync(zipPath).size / (1024 * 1024)).toFixed(1);
  console.log(`Backup written: ${zipPath} (${sizeMb} MB)`);

  // Prune old backups.
  const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
  let pruned = 0;
  for (const name of readdirSync(BACKUPS_DIR)) {
    if (!name.startsWith("apex-backup-") || !name.endsWith(".zip")) continue;
    const p = path.join(BACKUPS_DIR, name);
    if (statSync(p).mtimeMs < cutoff) {
      unlinkSync(p);
      pruned++;
    }
  }
  if (pruned > 0) console.log(`Pruned ${pruned} backup(s) older than ${RETENTION_DAYS} days.`);
}

main().catch((err) => {
  console.error("Backup failed:", err);
  process.exit(1);
});

/**
 * AUTOMATING THIS DAILY
 * ----------------------
 * Once the app is hosted somewhere (Railway, Render, a VPS -- see the
 * hosting discussion), "daily" needs a scheduler that survives the app
 * not being open in a browser:
 *
 *  - Plain Linux/VPS host: a cron entry, e.g.
 *      0 2 * * * cd /path/to/apex-portal && /usr/bin/npm run db:backup >> /var/log/apex-backup.log 2>&1
 *  - Railway/Render: both offer a "cron job" / "scheduled job" feature in
 *    their dashboard that can run `npm run db:backup` on a schedule
 *    without needing a server you manage yourself.
 *
 * Either way, data/backups/ still lives on the SAME disk as the live
 * database. For real safety the zip also needs to leave that server --
 * e.g. synced to a cheap off-site bucket (Backblaze B2, S3, or similar)
 * right after it's created. That needs an account + credentials you'll
 * need to set up; once you have one, this script can be extended to
 * upload the zip there automatically as the last step.
 */
