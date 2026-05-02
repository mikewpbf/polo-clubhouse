import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { db, pool } from "@workspace/db";
import {
  clubsTable,
  tournamentsTable,
  matchesTable,
  teamsTable,
} from "@workspace/db/schema";

// Same R2 mock as serverMatchPreview.test.ts — keeps the test hermetic
// and lets us assert that the job invokes the storage layer for every
// missing-preview match (and only those).
const uploadCalls: Array<{ filePath: string }> = [];
vi.mock("./objectStorage", async () => {
  const actual = await vi.importActual<typeof import("./objectStorage")>("./objectStorage");
  class MockObjectStorageService {
    async uploadPublicObject(filePath: string, _body: Buffer, _contentType: string) {
      uploadCalls.push({ filePath });
      return { key: `public/${filePath}`, url: `/api/storage/public-objects/${filePath}` };
    }
  }
  return { ...actual, ObjectStorageService: MockObjectStorageService };
});

const { runMatchPreviewBackfillOnce, __resetBackfillRunningForTests } =
  await import("./matchPreviewBackfillJob");

const created = {
  clubIds: [] as string[],
  tournamentIds: [] as string[],
  teamIds: [] as string[],
  matchIds: [] as string[],
};

let clubId = "";
let tournamentId = "";
let homeId = "";
let awayId = "";

beforeEach(async () => {
  uploadCalls.length = 0;
  __resetBackfillRunningForTests();
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const [club] = await db.insert(clubsTable).values({ name: `BF Club ${stamp}`, slug: `bf-${stamp}` }).returning();
  clubId = club.id;
  created.clubIds.push(clubId);
  const [tournament] = await db.insert(tournamentsTable)
    .values({ name: `BF Tournament ${stamp}`, clubId, status: "published" }).returning();
  tournamentId = tournament.id;
  created.tournamentIds.push(tournamentId);
  const [home] = await db.insert(teamsTable).values({ name: `BF Home ${stamp}`, clubId }).returning();
  const [away] = await db.insert(teamsTable).values({ name: `BF Away ${stamp}`, clubId }).returning();
  homeId = home.id; awayId = away.id;
  created.teamIds.push(homeId, awayId);
});

afterEach(async () => {
  if (created.matchIds.length) await db.delete(matchesTable).where(inArray(matchesTable.id, created.matchIds));
  if (created.tournamentIds.length) await db.delete(tournamentsTable).where(inArray(tournamentsTable.id, created.tournamentIds));
  if (created.teamIds.length) await db.delete(teamsTable).where(inArray(teamsTable.id, created.teamIds));
  if (created.clubIds.length) await db.delete(clubsTable).where(inArray(clubsTable.id, created.clubIds));
  created.matchIds = []; created.tournamentIds = []; created.teamIds = []; created.clubIds = [];
});

afterAll(async () => { await pool.end(); });

async function makeMatch(opts: { withPreview?: boolean } = {}): Promise<string> {
  const values: Record<string, unknown> = {
    tournamentId,
    homeTeamId: homeId,
    awayTeamId: awayId,
    scheduledAt: new Date(Date.now() + 60 * 60_000),
    status: "scheduled",
  };
  if (opts.withPreview) {
    values.previewImageUrl = "/api/storage/public-objects/match-previews/preexisting.png";
    values.previewImageUpdatedAt = new Date();
  }
  const [m] = await db.insert(matchesTable).values(values as any).returning();
  created.matchIds.push(m.id);
  return m.id;
}

describe("runMatchPreviewBackfillOnce", () => {
  it("processes only matches with NULL previewImageUrl and skips ones with a stored preview", async () => {
    const missingId = await makeMatch();
    const presentId = await makeMatch({ withPreview: true });

    // Limit to a large enough batch to see both rows. The runtime
    // selector relies on `IS NULL` so the present row should be
    // ignored even when the batch size could fit it.
    const result = await runMatchPreviewBackfillOnce(50);

    // Other tests in the suite may also have created NULL-preview
    // rows that pre-date this test, so we assert at-least semantics
    // for our specific row IDs rather than exact counts.
    expect(result.scanned).toBeGreaterThanOrEqual(1);
    expect(result.succeeded).toBeGreaterThanOrEqual(1);

    const uploadedPaths = uploadCalls.map(c => c.filePath);
    expect(uploadedPaths).toContain(`match-previews/${missingId}.png`);
    expect(uploadedPaths).not.toContain(`match-previews/${presentId}.png`);

    const [missingRow] = await db.select().from(matchesTable).where(eq(matchesTable.id, missingId));
    expect(missingRow.previewImageUrl).toBe(`/api/storage/public-objects/match-previews/${missingId}.png`);
    expect(missingRow.previewImageUpdatedAt).toBeTruthy();

    // The pre-existing preview must be untouched (URL string stays as
    // we stored it, not the auto-generated path).
    const [presentRow] = await db.select().from(matchesTable).where(eq(matchesTable.id, presentId));
    expect(presentRow.previewImageUrl).toBe("/api/storage/public-objects/match-previews/preexisting.png");
  });

  it("respects the batch limit so a single pass never overwhelms storage", async () => {
    // Create 3 missing-preview matches; ask the job for at most 2.
    // The 3rd must be left for the next pass.
    const ids = [await makeMatch(), await makeMatch(), await makeMatch()];

    // Filter the upload-call counter to OUR matches so other tests'
    // residual NULL-preview rows don't inflate it.
    const before = uploadCalls.length;
    const result = await runMatchPreviewBackfillOnce(2);
    expect(result.scanned).toBeLessThanOrEqual(2);

    const oursUploaded = uploadCalls
      .slice(before)
      .map(c => c.filePath)
      .filter(p => ids.some(id => p === `match-previews/${id}.png`));
    expect(oursUploaded.length).toBeLessThanOrEqual(2);
  });
});
