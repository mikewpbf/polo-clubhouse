import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { db, pool } from "@workspace/db";
import {
  clubsTable,
  tournamentsTable,
  matchesTable,
  teamsTable,
} from "@workspace/db/schema";

// Mock object storage so we don't hit R2 in tests. The mock records
// every uploaded payload so assertions can verify it's a valid PNG and
// that the storage key is deterministic per match.
const uploadCalls: Array<{ filePath: string; body: Buffer; contentType: string }> = [];
vi.mock("./objectStorage", async () => {
  const actual = await vi.importActual<typeof import("./objectStorage")>("./objectStorage");
  class MockObjectStorageService {
    async uploadPublicObject(filePath: string, body: Buffer, contentType: string) {
      uploadCalls.push({ filePath, body, contentType });
      return { key: `public/${filePath}`, url: `/api/storage/public-objects/${filePath}` };
    }
  }
  return { ...actual, ObjectStorageService: MockObjectStorageService };
});

const {
  buildMatchPreviewSvg,
  renderMatchPreviewPng,
  generateAndStoreMatchPreview,
} = await import("./serverMatchPreview");

const PNG_HEADER = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const created = {
  clubIds: [] as string[],
  tournamentIds: [] as string[],
  teamIds: [] as string[],
  matchIds: [] as string[],
};

afterEach(async () => {
  uploadCalls.length = 0;
  if (created.matchIds.length) await db.delete(matchesTable).where(inArray(matchesTable.id, created.matchIds));
  if (created.tournamentIds.length) await db.delete(tournamentsTable).where(inArray(tournamentsTable.id, created.tournamentIds));
  if (created.teamIds.length) await db.delete(teamsTable).where(inArray(teamsTable.id, created.teamIds));
  if (created.clubIds.length) await db.delete(clubsTable).where(inArray(clubsTable.id, created.clubIds));
  created.matchIds = []; created.tournamentIds = []; created.teamIds = []; created.clubIds = [];
});

afterAll(async () => { await pool.end(); });

describe("buildMatchPreviewSvg", () => {
  it("escapes XML special characters in team and tournament names", () => {
    // Without escaping, an injected `</svg>` could break the document
    // structure, and `&` would produce malformed XML that resvg refuses.
    const svg = buildMatchPreviewSvg({
      homeName: "<Tigers> & Co",
      awayName: 'Bears "Pro"',
      homeColor: "#ff0000",
      awayColor: "#00ff00",
      headline: "Cup & Final </svg>",
      badge: "LIVE",
      date: "May 1",
      time: "15:00 UTC",
      location: "Field A",
      accentColor: "#1B5E20",
    });
    expect(svg).not.toContain("<Tigers>");
    expect(svg).not.toContain("</svg>L");
    expect(svg).toContain("&lt;Tigers&gt;");
    expect(svg).toContain("&amp;");
  });

  it("renders TBD placeholders when team names are empty", () => {
    const svg = buildMatchPreviewSvg({
      homeName: "",
      awayName: "",
      homeColor: null,
      awayColor: null,
      headline: "Match Day",
      badge: "",
      date: "",
      time: "",
      location: "",
      accentColor: null,
    });
    expect(svg).toContain("TBD");
  });
});

describe("renderMatchPreviewPng", () => {
  it("produces a non-empty PNG buffer with a valid signature", () => {
    const png = renderMatchPreviewPng({
      homeName: "Home Team",
      awayName: "Away Team",
      homeColor: "#1B5E20",
      awayColor: "#374151",
      headline: "Test Tournament",
      badge: "UPCOMING",
      date: "May 1, 2026",
      time: "3:00 PM UTC",
      location: "Field 1 — Test Club",
      accentColor: "#1B5E20",
    });
    expect(Buffer.isBuffer(png)).toBe(true);
    expect(png.length).toBeGreaterThan(1024);
    expect(png.subarray(0, 8).equals(PNG_HEADER)).toBe(true);
  });

  it("tolerates malformed colour strings by falling back to defaults", () => {
    // A bad hex shouldn't crash the renderer — parseHex returns null and
    // the SVG falls back to the accent / neutral colours.
    const png = renderMatchPreviewPng({
      homeName: "X",
      awayName: "Y",
      homeColor: "not-a-colour",
      awayColor: "#zzzzzz",
      headline: "H",
      badge: "",
      date: "",
      time: "",
      location: "",
      accentColor: "garbage",
    });
    expect(png.subarray(0, 8).equals(PNG_HEADER)).toBe(true);
  });
});

describe("generateAndStoreMatchPreview", () => {
  let matchId = "";

  beforeEach(async () => {
    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const [club] = await db.insert(clubsTable).values({ name: `SP Club ${stamp}`, slug: `sp-${stamp}` }).returning();
    created.clubIds.push(club.id);
    const [tournament] = await db.insert(tournamentsTable)
      .values({ name: `SP Tournament ${stamp}`, clubId: club.id, status: "published" }).returning();
    created.tournamentIds.push(tournament.id);
    const [home] = await db.insert(teamsTable)
      .values({ name: `Home SP ${stamp}`, clubId: club.id, primaryColor: "#1B5E20" }).returning();
    const [away] = await db.insert(teamsTable)
      .values({ name: `Away SP ${stamp}`, clubId: club.id, primaryColor: "#374151" }).returning();
    created.teamIds.push(home.id, away.id);
    const [match] = await db.insert(matchesTable).values({
      tournamentId: tournament.id,
      homeTeamId: home.id,
      awayTeamId: away.id,
      scheduledAt: new Date(Date.now() + 60 * 60_000),
      status: "scheduled",
    }).returning();
    matchId = match.id;
    created.matchIds.push(matchId);
  });

  it("renders, uploads, and persists a stable preview URL on the match row", async () => {
    const ok = await generateAndStoreMatchPreview(matchId);
    expect(ok).toBe(true);

    expect(uploadCalls.length).toBe(1);
    expect(uploadCalls[0]!.filePath).toBe(`match-previews/${matchId}.png`);
    expect(uploadCalls[0]!.contentType).toBe("image/png");
    expect(uploadCalls[0]!.body.subarray(0, 8).equals(PNG_HEADER)).toBe(true);

    const [row] = await db.select().from(matchesTable).where(eq(matchesTable.id, matchId));
    expect(row.previewImageUrl).toBe(`/api/storage/public-objects/match-previews/${matchId}.png`);
    expect(row.previewImageUpdatedAt).toBeTruthy();
  });

  it("is idempotent — the same storage key is reused on a second call", async () => {
    const first = await generateAndStoreMatchPreview(matchId);
    expect(first).toBe(true);
    const firstRow = (await db.select().from(matchesTable).where(eq(matchesTable.id, matchId)))[0];
    const firstAt = firstRow.previewImageUpdatedAt!;

    await new Promise(r => setTimeout(r, 20));

    const second = await generateAndStoreMatchPreview(matchId);
    expect(second).toBe(true);
    expect(uploadCalls.length).toBe(2);
    expect(uploadCalls[0]!.filePath).toBe(uploadCalls[1]!.filePath);

    const secondRow = (await db.select().from(matchesTable).where(eq(matchesTable.id, matchId)))[0];
    expect(secondRow.previewImageUrl).toBe(firstRow.previewImageUrl);
    expect(secondRow.previewImageUpdatedAt!.getTime()).toBeGreaterThan(firstAt.getTime());
  });

  it("returns false (and never throws) for an unknown match id", async () => {
    const ok = await generateAndStoreMatchPreview("00000000-0000-0000-0000-000000000000");
    expect(ok).toBe(false);
    expect(uploadCalls.length).toBe(0);
  });
});
