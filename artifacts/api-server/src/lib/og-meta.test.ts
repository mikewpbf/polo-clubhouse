import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { db, pool } from "@workspace/db";
import {
  clubsTable,
  tournamentsTable,
  matchesTable,
  matchShareLinksTable,
  teamsTable,
  fieldsTable,
} from "@workspace/db/schema";
import type { Request } from "express";
import { buildOg } from "./og-meta";

// Direct unit tests for the OG meta builder. The middleware itself is only
// mounted in production (see app.ts), so exercising the route through HTTP
// from a test would require flipping NODE_ENV and standing up the static
// SPA dir. Calling buildOg directly gives the same coverage of the per-route
// logic without that overhead.

function fakeReq(path: string): Request {
  return {
    protocol: "https",
    originalUrl: path,
    path,
    get: (h: string) => (h.toLowerCase() === "host" ? "polo-manager.test" : ""),
  } as unknown as Request;
}

describe("buildOg — match-specific link previews", () => {
  const created = {
    clubIds: [] as string[],
    tournamentIds: [] as string[],
    teamIds: [] as string[],
    fieldIds: [] as string[],
    matchIds: [] as string[],
    shareLinkIds: [] as string[],
  };

  let matchId = "";
  let scheduledMatchId = "";
  let homeName = "";
  let awayName = "";
  let tournamentName = "";

  // Per-test fixture for share-link tokens, populated in beforeEach. Typed
  // explicitly so we don't need a `globalThis as any` escape hatch — vitest
  // runs each `it` block sequentially within a describe, so a closure-scoped
  // mutable record is the right shape here.
  type TokenFixture = {
    stats: string;
    gfx: string;
    scoreboard: string;
    full_control: string;
    revoked: string;
    expired: string;
  };
  let tokens: TokenFixture = {
    stats: "", gfx: "", scoreboard: "", full_control: "",
    revoked: "", expired: "",
  };

  beforeEach(async () => {
    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    const [club] = await db.insert(clubsTable)
      .values({ name: `OG Club ${stamp}`, slug: `ogc-${stamp}`, logoUrl: "https://cdn.test/club.png" })
      .returning();
    created.clubIds.push(club.id);

    const [tournament] = await db.insert(tournamentsTable)
      .values({ name: `OG Open ${stamp}`, clubId: club.id, status: "published" })
      .returning();
    created.tournamentIds.push(tournament.id);
    tournamentName = tournament.name;

    const [home] = await db.insert(teamsTable)
      .values({ name: `Home OG ${stamp}`, clubId: club.id, logoUrl: "https://cdn.test/home.png" })
      .returning();
    const [away] = await db.insert(teamsTable)
      .values({ name: `Away OG ${stamp}`, clubId: club.id, logoUrl: "https://cdn.test/away.png" })
      .returning();
    created.teamIds.push(home.id, away.id);
    // After enrichMatch swap logic we don't use teamA/teamB ordering here —
    // for OG output we only check that the description references the names.
    homeName = home.name;
    awayName = away.name;

    const [field] = await db.insert(fieldsTable)
      .values({ name: `Field OG ${stamp}`, clubId: club.id })
      .returning();
    created.fieldIds.push(field.id);

    // A LIVE match with a stored preview image. Score is intentionally
    // non-zero to verify it does NOT leak into the OG description.
    const [liveMatch] = await db.insert(matchesTable).values({
      tournamentId: tournament.id,
      homeTeamId: home.id,
      awayTeamId: away.id,
      fieldId: field.id,
      scheduledAt: new Date(Date.now() - 30 * 60_000),
      status: "live",
      homeScore: 7,
      awayScore: 5,
      currentChukker: 3,
      clockIsRunning: true,
      clockElapsedSeconds: 120,
      previewImageUrl: "/api/storage/public-objects/match-previews/test.png",
      previewImageUpdatedAt: new Date(1746300000000),
    }).returning();
    matchId = liveMatch.id;
    created.matchIds.push(matchId);

    // A scheduled (future) match with no preview image yet. Used to verify
    // fallback chain (team logo → opengraph.jpg).
    const [scheduledMatch] = await db.insert(matchesTable).values({
      tournamentId: tournament.id,
      homeTeamId: home.id,
      awayTeamId: away.id,
      fieldId: field.id,
      scheduledAt: new Date(Date.UTC(2099, 0, 1, 18, 0, 0)),
      status: "scheduled",
      homeScore: 0,
      awayScore: 0,
      currentChukker: 1,
      clockIsRunning: false,
      clockElapsedSeconds: 0,
    }).returning();
    scheduledMatchId = scheduledMatch.id;
    created.matchIds.push(scheduledMatchId);

    const validExpiry = new Date(Date.now() + 60 * 60_000);
    const [validLink] = await db.insert(matchShareLinksTable).values({
      matchId,
      pageType: "stats",
      token: `ogstats-${stamp}`,
      expiresAt: validExpiry,
    }).returning();
    created.shareLinkIds.push(validLink.id);

    const [gfxLink] = await db.insert(matchShareLinksTable).values({
      matchId,
      pageType: "gfx",
      token: `oggfx-${stamp}`,
      expiresAt: validExpiry,
    }).returning();
    created.shareLinkIds.push(gfxLink.id);

    const [scbLink] = await db.insert(matchShareLinksTable).values({
      matchId,
      pageType: "scoreboard",
      token: `ogscb-${stamp}`,
      expiresAt: validExpiry,
    }).returning();
    created.shareLinkIds.push(scbLink.id);

    const [fcLink] = await db.insert(matchShareLinksTable).values({
      matchId,
      pageType: "full_control",
      token: `ogfc-${stamp}`,
      expiresAt: validExpiry,
    }).returning();
    created.shareLinkIds.push(fcLink.id);

    // Revoked + expired tokens for the negative cases.
    const [revokedLink] = await db.insert(matchShareLinksTable).values({
      matchId,
      pageType: "stats",
      token: `ogrev-${stamp}`,
      expiresAt: validExpiry,
      revokedAt: new Date(),
    }).returning();
    created.shareLinkIds.push(revokedLink.id);

    // Use scheduledMatchId so we don't collide with the live match's active
    // stats link on the partial unique index (match_id, page_type) WHERE
    // revoked_at IS NULL. Expiry, not match identity, is what's under test.
    const [expiredLink] = await db.insert(matchShareLinksTable).values({
      matchId: scheduledMatchId,
      pageType: "stats",
      token: `ogexp-${stamp}`,
      expiresAt: new Date(Date.now() - 1000),
    }).returning();
    created.shareLinkIds.push(expiredLink.id);

    tokens = {
      stats: validLink.token,
      gfx: gfxLink.token,
      scoreboard: scbLink.token,
      full_control: fcLink.token,
      revoked: revokedLink.token,
      expired: expiredLink.token,
    };
  });

  afterEach(async () => {
    if (created.shareLinkIds.length) await db.delete(matchShareLinksTable).where(inArray(matchShareLinksTable.id, created.shareLinkIds));
    if (created.matchIds.length) await db.delete(matchesTable).where(inArray(matchesTable.id, created.matchIds));
    if (created.fieldIds.length) await db.delete(fieldsTable).where(inArray(fieldsTable.id, created.fieldIds));
    if (created.teamIds.length) await db.delete(teamsTable).where(inArray(teamsTable.id, created.teamIds));
    if (created.tournamentIds.length) await db.delete(tournamentsTable).where(inArray(tournamentsTable.id, created.tournamentIds));
    if (created.clubIds.length) await db.delete(clubsTable).where(inArray(clubsTable.id, created.clubIds));
    created.shareLinkIds = []; created.matchIds = []; created.fieldIds = [];
    created.teamIds = []; created.tournamentIds = []; created.clubIds = [];
  });

  afterAll(async () => { await pool.end(); });

  it("/match/:id — LIVE match: no scores, includes status + preview image with cache-bust", async () => {
    const og = await buildOg(fakeReq(`/match/${matchId}`));
    expect(og).toBeTruthy();
    expect(og!.title).toContain(homeName);
    expect(og!.title).toContain(awayName);
    expect(og!.title).toContain(tournamentName);
    expect(og!.title).toContain("LIVE");

    // Critical: scores must NOT leak into title or description.
    expect(og!.title).not.toMatch(/\b7\b/);
    expect(og!.title).not.toMatch(/\b5\b/);
    expect(og!.description).not.toMatch(/\b7\b/);
    expect(og!.description).not.toMatch(/\b5\b/);
    expect(og!.description).not.toMatch(/7\s*[-:–]\s*5/);

    expect(og!.description).toContain("LIVE");
    expect(og!.description).toContain(tournamentName);

    // Preview image present, absolute, cache-busted.
    expect(og!.image).toBeTruthy();
    expect(og!.image).toMatch(/^https:\/\/polo-manager\.test\/api\/storage\/public-objects\/match-previews\/test\.png\?v=\d+/);
  });

  it("/match/:id — scheduled match: no scores, falls back to team logo when no preview exists", async () => {
    const og = await buildOg(fakeReq(`/match/${scheduledMatchId}`));
    expect(og).toBeTruthy();
    expect(og!.title).toContain(homeName);
    expect(og!.title).toContain(awayName);
    expect(og!.title).toContain("Scheduled");
    expect(og!.description).toContain("Scheduled");
    expect(og!.image).toBe("https://cdn.test/home.png");
  });

  it("/match/:id — unknown match returns null (middleware passes through to SPA)", async () => {
    const og = await buildOg(fakeReq("/match/00000000-0000-0000-0000-000000000000"));
    expect(og).toBeNull();
  });

  it.each([
    ["stats", "Stats Control"],
    ["gfx", "GFX Control"],
    ["scoreboard", "Scoreboard Control"],
    ["full_control", "Full Match Control"],
  ])("/share/%s/:token resolves to a per-match preview labelled '%s'", async (pageType, label) => {
    const og = await buildOg(fakeReq(`/share/${pageType}/${tokens[pageType as keyof TokenFixture]}`));
    expect(og).toBeTruthy();
    expect(og!.title.startsWith(label)).toBe(true);
    expect(og!.title).toContain(homeName);
    expect(og!.title).toContain(awayName);
    expect(og!.description).toContain(tournamentName);
    expect(og!.description).not.toMatch(/\b7\b/);
    expect(og!.description).not.toMatch(/\b5\b/);
    expect(og!.image).toMatch(/match-previews\/test\.png\?v=\d+/);
  });

  it("/share/:pageType/:token — revoked token returns generic 'no longer active' card", async () => {
    const og = await buildOg(fakeReq(`/share/stats/${tokens.revoked}`));
    expect(og).toBeTruthy();
    expect(og!.title).toContain("no longer active");
    // Must NOT leak match details.
    expect(og!.title).not.toContain(homeName);
    expect(og!.description).not.toContain(homeName);
    expect(og!.description).not.toContain(tournamentName);
    expect(og!.image).toContain("opengraph.jpg");
  });

  it("/share/:pageType/:token — expired token returns generic 'no longer active' card", async () => {
    const og = await buildOg(fakeReq(`/share/stats/${tokens.expired}`));
    expect(og).toBeTruthy();
    expect(og!.title).toContain("no longer active");
    expect(og!.description).not.toContain(homeName);
    expect(og!.image).toContain("opengraph.jpg");
  });

  it("/share/:pageType/:token — unknown token returns generic 'no longer active' card", async () => {
    const og = await buildOg(fakeReq("/share/stats/this-token-does-not-exist"));
    expect(og).toBeTruthy();
    expect(og!.title).toContain("no longer active");
  });

  it("/share/:pageType/:token — unknown pageType returns null (passes through)", async () => {
    const og = await buildOg(fakeReq(`/share/bogus/${tokens.stats}`));
    expect(og).toBeNull();
  });

  it("/share/:pageType/:token — pageType/token mismatch returns generic non-leaky card (no mislabel)", async () => {
    // tokens.stats was issued for pageType="stats". Asking for it under
    // /share/full_control/... must NOT render a "Full Match Control" card —
    // that would let a sender mislabel a stats-only link as full-control in
    // chat apps. Treat the same as a revoked token.
    const og = await buildOg(fakeReq(`/share/full_control/${tokens.stats}`));
    expect(og).toBeTruthy();
    expect(og!.title).toContain("no longer active");
    expect(og!.title).not.toContain("Full Match Control");
    expect(og!.title).not.toContain(homeName);
    expect(og!.description).not.toContain(tournamentName);
    expect(og!.image).toContain("opengraph.jpg");
  });
});
