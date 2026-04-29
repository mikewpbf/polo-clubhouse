import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { db, pool } from "@workspace/db";
import {
  clubsTable,
  fieldsTable,
  fieldWeatherCacheTable,
} from "@workspace/db/schema";
import { cleanupExpiredWeatherCache } from "./weather-cache-cleanup";

describe("cleanupExpiredWeatherCache", () => {
  let clubId: string;
  const fieldIds: string[] = [];

  beforeEach(async () => {
    const slug = `cleanup-club-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const [club] = await db
      .insert(clubsTable)
      .values({ name: "Cleanup Club", slug })
      .returning();
    clubId = club.id;
  });

  afterEach(async () => {
    if (fieldIds.length > 0) {
      await db
        .delete(fieldWeatherCacheTable)
        .where(inArray(fieldWeatherCacheTable.fieldId, fieldIds));
      await db.delete(fieldsTable).where(inArray(fieldsTable.id, fieldIds));
      fieldIds.length = 0;
    }
    await db.delete(clubsTable).where(eq(clubsTable.id, clubId));
  });

  afterAll(async () => {
    await pool.end();
  });

  async function makeField(): Promise<string> {
    const [field] = await db
      .insert(fieldsTable)
      .values({ clubId, name: "Cleanup Field", lat: "0", lng: "0" })
      .returning();
    fieldIds.push(field.id);
    return field.id;
  }

  it("deletes rows whose expires_at is older than 1 day, and keeps fresher rows", async () => {
    const staleField = await makeField();
    const recentlyExpiredField = await makeField();
    const freshField = await makeField();

    const now = Date.now();
    const twoDaysAgo = new Date(now - 2 * 24 * 60 * 60 * 1000);
    const oneHourAgo = new Date(now - 60 * 60 * 1000);
    const inOneHour = new Date(now + 60 * 60 * 1000);

    await db.insert(fieldWeatherCacheTable).values([
      {
        fieldId: staleField,
        payload: {},
        isError: false,
        expiresAt: twoDaysAgo,
        updatedAt: twoDaysAgo,
      },
      {
        fieldId: recentlyExpiredField,
        payload: {},
        isError: false,
        expiresAt: oneHourAgo,
        updatedAt: oneHourAgo,
      },
      {
        fieldId: freshField,
        payload: {},
        isError: false,
        expiresAt: inOneHour,
        updatedAt: new Date(),
      },
    ]);

    const deleted = await cleanupExpiredWeatherCache();

    expect(deleted).toBeGreaterThanOrEqual(1);

    const rows = await db
      .select()
      .from(fieldWeatherCacheTable)
      .where(inArray(fieldWeatherCacheTable.fieldId, fieldIds));

    const remainingIds = new Set(rows.map((r) => r.fieldId));
    expect(remainingIds.has(staleField)).toBe(false);
    expect(remainingIds.has(recentlyExpiredField)).toBe(true);
    expect(remainingIds.has(freshField)).toBe(true);
  });

  it("is idempotent: running twice in a row leaves the same set of rows", async () => {
    const staleField = await makeField();
    const freshField = await makeField();

    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    const inOneHour = new Date(Date.now() + 60 * 60 * 1000);

    await db.insert(fieldWeatherCacheTable).values([
      {
        fieldId: staleField,
        payload: {},
        isError: false,
        expiresAt: twoDaysAgo,
        updatedAt: twoDaysAgo,
      },
      {
        fieldId: freshField,
        payload: {},
        isError: false,
        expiresAt: inOneHour,
        updatedAt: new Date(),
      },
    ]);

    await cleanupExpiredWeatherCache();
    const second = await cleanupExpiredWeatherCache();
    expect(second).toBe(0);

    const rows = await db
      .select()
      .from(fieldWeatherCacheTable)
      .where(inArray(fieldWeatherCacheTable.fieldId, fieldIds));
    const remainingIds = new Set(rows.map((r) => r.fieldId));
    expect(remainingIds.has(staleField)).toBe(false);
    expect(remainingIds.has(freshField)).toBe(true);
  });
});
