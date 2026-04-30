import app from "./app";
import { logger } from "./lib/logger";
import { db, pool } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { startWeatherCacheCleanup } from "./lib/weather-cache-cleanup";

async function applyStartupMigrations() {
  try {
    await pool.query(`
      ALTER TABLE team_players
        ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true
    `);
    logger.info("team_players.is_active column ensured");

    // Broad data correction for the roster-toggle bug:
    // The old PUT /teams/:teamId/players/:playerId incorrectly wrote isActive to
    // players.is_active (global) instead of team_players.is_active (per-team).
    // Any player who has team memberships but is globally inactive was almost
    // certainly deactivated by that bug, not intentionally archived. Restore them.
    const { rowCount: restoredPlayers } = await pool.query(`
      UPDATE players p
         SET is_active = true
       WHERE p.is_active = false
         AND EXISTS (
           SELECT 1 FROM team_players tp WHERE tp.player_id = p.id
         )
    `);
    if ((restoredPlayers ?? 0) > 0) {
      logger.info({ restoredPlayers }, "Restored players incorrectly deactivated by roster-toggle bug");
    }

    // Per-player targeted fix: Riley Ganzi's Boca Raton 2026 roster row should be
    // inactive (she left that squad). Set it only if it wasn't already corrected.
    await pool.query(`
      UPDATE team_players
         SET is_active = false
       WHERE id = 'c3795519-faa6-41b9-ada9-874f3be7bb9f'
         AND is_active = true
    `);

    logger.info("Startup migrations applied");
  } catch (e) {
    logger.error({ err: e }, "Startup migration failed — aborting server start");
    throw e;
  }
}

async function seedSuperAdmin() {
  try {
    const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, "mike"));
    if (!existing) {
      const passwordHash = await bcrypt.hash("mmff", 10);
      await db.insert(usersTable).values({
        email: "mike",
        passwordHash,
        displayName: "Mike",
        role: "super_admin",
      });
      logger.info("Seeded super admin user 'mike'");
    }
  } catch (e) {
    logger.error({ err: e }, "Failed to seed super admin");
  }
}

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

applyStartupMigrations()
  .then(() => seedSuperAdmin())
  .then(() => {
    app.listen(port, (err) => {
      if (err) {
        logger.error({ err }, "Error listening on port");
        process.exit(1);
      }

      logger.info({ port }, "Server listening");
      startWeatherCacheCleanup();
    });
  });
