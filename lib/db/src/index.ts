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

async function baselineInitialMigration(migrationsFolder: string): Promise<void> {
  const journalPath = path.join(migrationsFolder, "meta", "_journal.json");
  if (!fs.existsSync(journalPath)) return;

  const journal = JSON.parse(fs.readFileSync(journalPath, "utf-8"));
  if (!journal.entries || journal.entries.length === 0) return;

  await pool.query(`CREATE SCHEMA IF NOT EXISTS drizzle`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
      id SERIAL PRIMARY KEY,
      hash text NOT NULL,
      created_at bigint
    )
  `);

  const { rows: migRows } = await pool.query(
    `SELECT COUNT(*) AS count FROM drizzle.__drizzle_migrations`,
  );
  const count = parseInt(migRows[0].count, 10);
  if (count > 0) return;

  const { rows: tableRows } = await pool.query(`
    SELECT COUNT(*) AS count
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN ('users', 'team_players', 'clubs', 'matches', 'tournaments',
                         'horses', 'players', 'fields', 'match_events',
                         'tournament_teams', 'admin_club_memberships',
                         'team_manager_assignments', 'spectator_follows',
                         'push_subscriptions', 'user_invites', 'possession_segments',
                         'field_weather_cache', 'play_dates', 'team_out_dates', 'teams')
  `);
  const existingTableCount = parseInt(tableRows[0].count, 10);
  if (existingTableCount < 20) return;

  const { rows: colRows } = await pool.query(`
    SELECT COUNT(*) AS count
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'team_players'
      AND column_name = 'is_active'
  `);
  const hasIsActive = parseInt(colRows[0].count, 10) > 0;
  if (!hasIsActive) return;

  const firstEntry = journal.entries[0];
  const sqlPath = path.join(migrationsFolder, `${firstEntry.tag}.sql`);
  if (!fs.existsSync(sqlPath)) return;

  const sqlContent = fs.readFileSync(sqlPath, "utf-8");
  const hash = crypto.createHash("sha256").update(sqlContent).digest("hex");

  await pool.query(
    `INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ($1, $2)`,
    [hash, firstEntry.when],
  );
}

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

export async function runMigrations(): Promise<void> {
  const migrationsFolder = resolveMigrationsFolder();
  await baselineInitialMigration(migrationsFolder);
  await migrate(db, { migrationsFolder });
}

export * from "./schema";
