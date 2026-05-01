import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { fileURLToPath } from "url";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool, { schema });

function resolveMigrationsFolder(): string {
  const candidates = [
    path.join(__dirname, "migrations"),
    path.join(__dirname, "../migrations"),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, "meta", "_journal.json"))) {
      return candidate;
    }
  }
  throw new Error(
    `Cannot find Drizzle migrations folder. Searched: ${candidates.join(", ")}`,
  );
}

/**
 * One-time adapter for databases created before the Drizzle migration system
 * was introduced (via drizzle-kit push). Those databases have the full schema
 * but no migration history, so Drizzle would try to re-run 0000_gray_payback
 * and fail on already-existing ENUMs.
 *
 * Logic:
 *   - Creates drizzle.__drizzle_migrations table if it doesn't exist
 *   - If the table is empty AND public.clubs already exists (i.e. pre-Drizzle DB):
 *     stamp 0000_gray_payback as already applied using its actual SQL hash
 *   - On a fresh empty database: does nothing — Drizzle runs all migrations normally
 *   - After the stamp exists (idempotent): does nothing on subsequent runs
 */
async function baselineInitialMigration(migrationsFolder: string): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`CREATE SCHEMA IF NOT EXISTS drizzle`);
    await client.query(`
      CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
        id SERIAL PRIMARY KEY,
        hash text NOT NULL,
        created_at bigint
      )
    `);

    const { rows: historyRows } = await client.query(
      `SELECT count(*)::int AS cnt FROM drizzle.__drizzle_migrations`
    );
    const isEmpty = historyRows[0].cnt === 0;
    if (!isEmpty) return;

    const { rows: tableRows } = await client.query(
      `SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = 'clubs'`
    );
    const isExistingDb = tableRows.length > 0;
    if (!isExistingDb) return;

    const sqlPath = path.join(migrationsFolder, "0000_gray_payback.sql");
    const sqlContent = fs.readFileSync(sqlPath, "utf8");
    const hash = crypto.createHash("sha256").update(sqlContent).digest("hex");

    // Use created_at equal to 0000_gray_payback's folderMillis (1777636684314).
    // Drizzle's migrate skips any migration where folderMillis <= lastDbMigration.created_at.
    // 0001_stream_anchor is given folderMillis 1777636684315 (one ms later) so it
    // runs normally; 0000_gray_payback (folderMillis 1777636684314) is skipped.
    const MIGRATION_0000_WHEN = 1777636684314;
    await client.query(
      `INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ($1, $2)`,
      [hash, MIGRATION_0000_WHEN]
    );
    console.log("Baselined 0000_gray_payback migration for pre-existing database");
  } finally {
    client.release();
  }
}

export async function runMigrations(): Promise<void> {
  const migrationsFolder = resolveMigrationsFolder();
  await baselineInitialMigration(migrationsFolder);
  await migrate(db, { migrationsFolder });
}

export * from "./schema";
