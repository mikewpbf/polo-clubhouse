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

    await pool.query(`
      UPDATE players
         SET is_active = true
       WHERE id = 'fe1eca3a-ec6b-4d65-8bff-bf264d9d8243'
         AND is_active = false
    `);

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
