import { db } from "@workspace/db";
import { fieldWeatherCacheTable } from "@workspace/db/schema";
import { sql } from "drizzle-orm";
import { logger } from "./logger";

const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;

export async function cleanupExpiredWeatherCache(): Promise<number> {
  const result = await db
    .delete(fieldWeatherCacheTable)
    .where(sql`${fieldWeatherCacheTable.expiresAt} < NOW() - interval '1 day'`);
  return result.rowCount ?? 0;
}

export function startWeatherCacheCleanup(): NodeJS.Timeout {
  const run = () => {
    cleanupExpiredWeatherCache()
      .then((count) => {
        if (count > 0) {
          logger.info({ count }, "Cleaned up expired weather cache rows");
        }
      })
      .catch((err) => {
        logger.error({ err }, "Failed to clean up expired weather cache rows");
      });
  };

  run();
  const handle = setInterval(run, CLEANUP_INTERVAL_MS);
  if (typeof handle.unref === "function") handle.unref();
  return handle;
}
