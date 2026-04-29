import { afterAll, afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import request from "supertest";
import { eq } from "drizzle-orm";
import { db, pool } from "@workspace/db";
import {
  clubsTable,
  fieldsTable,
  fieldWeatherCacheTable,
} from "@workspace/db/schema";
import app from "../app";

type FetchSpy = MockInstance<typeof globalThis.fetch>;

function fetchInputToUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

function buildWeatherSuccessResponse(overrides: {
  temperature?: number;
  weatherCode?: number;
  windGust?: number;
  timezone?: string;
} = {}): Response {
  const body = {
    current: {
      temperature_2m: overrides.temperature ?? 72,
      weather_code: overrides.weatherCode ?? 0,
      wind_gusts_10m: overrides.windGust ?? 5,
    },
    timezone: overrides.timezone ?? "America/New_York",
  };
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("GET /api/fields/:fieldId/weather", () => {
  let clubId: string;
  let fieldId: string;
  let fetchSpy: FetchSpy;

  beforeEach(async () => {
    const slug = `test-club-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const [club] = await db
      .insert(clubsTable)
      .values({ name: "Test Club", slug })
      .returning();
    clubId = club.id;
    const [field] = await db
      .insert(fieldsTable)
      .values({
        clubId,
        name: "Test Field",
        lat: "40.7128",
        lng: "-74.0060",
      })
      .returning();
    fieldId = field.id;

    fetchSpy = vi.spyOn(globalThis, "fetch") as FetchSpy;
  });

  afterEach(async () => {
    fetchSpy.mockRestore();
    await db
      .delete(fieldWeatherCacheTable)
      .where(eq(fieldWeatherCacheTable.fieldId, fieldId));
    await db.delete(fieldsTable).where(eq(fieldsTable.id, fieldId));
    await db.delete(clubsTable).where(eq(clubsTable.id, clubId));
  });

  afterAll(async () => {
    await pool.end();
  });

  it("live success path writes both payload and last_success_payload", async () => {
    fetchSpy.mockImplementation(async () =>
      buildWeatherSuccessResponse({
        temperature: 72,
        weatherCode: 0,
        windGust: 8,
      }),
    );

    const res = await request(app).get(`/api/fields/${fieldId}/weather`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      temperatureF: 72,
      windGustMph: 8,
      weatherCode: 0,
      condition: "Clear",
      timezone: "America/New_York",
    });
    expect(res.body.stale).toBeUndefined();
    expect(typeof res.body.fetchedAt).toBe("string");

    const [cached] = await db
      .select()
      .from(fieldWeatherCacheTable)
      .where(eq(fieldWeatherCacheTable.fieldId, fieldId));
    expect(cached).toBeDefined();
    expect(cached!.isError).toBe(false);
    expect(cached!.payload).toMatchObject({
      temperatureF: 72,
      windGustMph: 8,
      weatherCode: 0,
      condition: "Clear",
    });
    expect(cached!.lastSuccessPayload).toMatchObject({
      temperatureF: 72,
      windGustMph: 8,
      weatherCode: 0,
      condition: "Clear",
    });
    expect((cached!.payload as { fetchedAt: string }).fetchedAt).toBe(
      (cached!.lastSuccessPayload as { fetchedAt: string }).fetchedAt,
    );
  });

  it("upstream failure preserves prior last_success_payload and returns it with stale: true", async () => {
    // Seed a successful cache entry that is already expired so the next call
    // is forced to hit the upstream.
    const priorSuccess = {
      temperatureF: 65,
      windGustMph: 12,
      weatherCode: 3,
      condition: "Overcast",
      timezone: "America/New_York",
      fetchedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    };
    await db.insert(fieldWeatherCacheTable).values({
      fieldId,
      payload: priorSuccess,
      isError: false,
      expiresAt: new Date(Date.now() - 1000),
      updatedAt: new Date(),
      lastSuccessPayload: priorSuccess,
    });

    fetchSpy.mockRejectedValue(new Error("upstream offline"));

    const res = await request(app).get(`/api/fields/${fieldId}/weather`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      temperatureF: 65,
      windGustMph: 12,
      weatherCode: 3,
      condition: "Overcast",
      stale: true,
    });
    expect(res.body.fetchedAt).toBe(priorSuccess.fetchedAt);

    const [cached] = await db
      .select()
      .from(fieldWeatherCacheTable)
      .where(eq(fieldWeatherCacheTable.fieldId, fieldId));
    expect(cached).toBeDefined();
    expect(cached!.isError).toBe(true);
    expect(cached!.lastSuccessPayload).toMatchObject({
      temperatureF: 65,
      windGustMph: 12,
      weatherCode: 3,
      condition: "Overcast",
      fetchedAt: priorSuccess.fetchedAt,
    });
    // The negative cache entry should expire ~60s into the future.
    const ttlMs = cached!.expiresAt.getTime() - Date.now();
    expect(ttlMs).toBeGreaterThan(0);
    expect(ttlMs).toBeLessThanOrEqual(60 * 1000);
  });

  it("upstream failure with no prior success returns 502", async () => {
    fetchSpy.mockRejectedValue(new Error("upstream offline"));

    const res = await request(app).get(`/api/fields/${fieldId}/weather`);

    expect(res.status).toBe(502);
    expect(res.body).toMatchObject({ message: "Weather provider unavailable" });

    const [cached] = await db
      .select()
      .from(fieldWeatherCacheTable)
      .where(eq(fieldWeatherCacheTable.fieldId, fieldId));
    expect(cached).toBeDefined();
    expect(cached!.isError).toBe(true);
    expect(cached!.lastSuccessPayload).toBeNull();
    const errPayload = cached!.payload as {
      statusCode: number;
      message: string;
    };
    expect(errPayload.statusCode).toBe(502);
    expect(errPayload.message).toBe("Weather provider unavailable");
  });

  it("fresh cached success is served without calling the upstream", async () => {
    const cachedPayload = {
      temperatureF: 70,
      windGustMph: 6,
      weatherCode: 1,
      condition: "Mostly Clear",
      timezone: "America/New_York",
      fetchedAt: new Date(Date.now() - 60 * 1000).toISOString(),
    };
    await db.insert(fieldWeatherCacheTable).values({
      fieldId,
      payload: cachedPayload,
      isError: false,
      // Still well within the 5-minute TTL.
      expiresAt: new Date(Date.now() + 4 * 60 * 1000),
      updatedAt: new Date(),
      lastSuccessPayload: cachedPayload,
    });

    fetchSpy.mockImplementation(async () => {
      throw new Error("upstream should not have been called");
    });

    const res = await request(app).get(`/api/fields/${fieldId}/weather`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      temperatureF: 70,
      windGustMph: 6,
      weatherCode: 1,
      condition: "Mostly Clear",
      timezone: "America/New_York",
      fetchedAt: cachedPayload.fetchedAt,
    });
    expect(res.body.stale).toBeUndefined();
    expect(fetchSpy.mock.calls.length).toBe(0);
  });

  it("fresh negative-cache row with prior success serves stale without calling upstream", async () => {
    const lastSuccess = {
      temperatureF: 58,
      windGustMph: 9,
      weatherCode: 2,
      condition: "Partly Cloudy",
      timezone: "America/New_York",
      fetchedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    };
    const errPayload = {
      statusCode: 502,
      message: "Weather provider unavailable",
      fetchedAt: new Date(Date.now() - 10 * 1000).toISOString(),
    };
    await db.insert(fieldWeatherCacheTable).values({
      fieldId,
      payload: errPayload,
      isError: true,
      // Still inside the 60s negative-cache window.
      expiresAt: new Date(Date.now() + 50 * 1000),
      updatedAt: new Date(),
      lastSuccessPayload: lastSuccess,
    });

    fetchSpy.mockImplementation(async () => {
      throw new Error("upstream should not have been called");
    });

    const res = await request(app).get(`/api/fields/${fieldId}/weather`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      temperatureF: 58,
      windGustMph: 9,
      weatherCode: 2,
      condition: "Partly Cloudy",
      timezone: "America/New_York",
      fetchedAt: lastSuccess.fetchedAt,
      stale: true,
    });
    expect(fetchSpy.mock.calls.length).toBe(0);
  });

  it("second call within the 5-minute success TTL is served from cache without calling upstream", async () => {
    fetchSpy.mockImplementation(async () =>
      buildWeatherSuccessResponse({
        temperature: 68,
        weatherCode: 2,
        windGust: 11,
      }),
    );

    const first = await request(app).get(`/api/fields/${fieldId}/weather`);
    expect(first.status).toBe(200);
    expect(first.body).toMatchObject({
      temperatureF: 68,
      windGustMph: 11,
      weatherCode: 2,
      condition: "Partly Cloudy",
    });
    const callsAfterFirst = fetchSpy.mock.calls.length;
    expect(callsAfterFirst).toBeGreaterThanOrEqual(1);

    // Sanity check: the cached row's expiresAt is within the 5-minute window.
    const [cached] = await db
      .select()
      .from(fieldWeatherCacheTable)
      .where(eq(fieldWeatherCacheTable.fieldId, fieldId));
    expect(cached).toBeDefined();
    expect(cached!.isError).toBe(false);
    const ttlMs = cached!.expiresAt.getTime() - Date.now();
    expect(ttlMs).toBeGreaterThan(0);
    expect(ttlMs).toBeLessThanOrEqual(5 * 60 * 1000);

    const second = await request(app).get(`/api/fields/${fieldId}/weather`);
    expect(second.status).toBe(200);
    expect(second.body).toMatchObject({
      temperatureF: 68,
      windGustMph: 11,
      weatherCode: 2,
      condition: "Partly Cloudy",
    });
    expect(second.body.stale).toBeUndefined();
    expect(second.body.fetchedAt).toBe(first.body.fetchedAt);
    expect(fetchSpy.mock.calls.length).toBe(callsAfterFirst);
  });

  it("geocodes a zipcode-only field, persists lat/lng, and returns weather", async () => {
    await db
      .update(fieldsTable)
      .set({ lat: null, lng: null, zipcode: "10001" })
      .where(eq(fieldsTable.id, fieldId));

    fetchSpy.mockImplementation(async (input: RequestInfo | URL) => {
      const url = fetchInputToUrl(input);
      if (url.includes("geocoding-api.open-meteo.com")) {
        return new Response(
          JSON.stringify({
            results: [
              { latitude: 40.7506, longitude: -73.9972, name: "New York" },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      if (url.includes("api.open-meteo.com")) {
        return buildWeatherSuccessResponse({
          temperature: 75,
          weatherCode: 1,
          windGust: 4,
        });
      }
      throw new Error(`unexpected fetch URL: ${url}`);
    });

    const res = await request(app).get(`/api/fields/${fieldId}/weather`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      temperatureF: 75,
      windGustMph: 4,
      weatherCode: 1,
      condition: "Mostly Clear",
    });

    const fetchedUrls = fetchSpy.mock.calls.map((c) => fetchInputToUrl(c[0]));
    expect(fetchedUrls.some((u) => u.includes("geocoding-api.open-meteo.com"))).toBe(true);
    expect(fetchedUrls.some((u) => u.includes("geocoding-api.open-meteo.com") && u.includes("10001"))).toBe(true);
    const weatherUrl = fetchedUrls.find((u) => u.includes("api.open-meteo.com") && !u.includes("geocoding"));
    expect(weatherUrl).toBeDefined();
    expect(weatherUrl).toContain("latitude=40.7506");
    expect(weatherUrl).toContain("longitude=-73.9972");

    const [updatedField] = await db
      .select()
      .from(fieldsTable)
      .where(eq(fieldsTable.id, fieldId));
    expect(updatedField.lat).not.toBeNull();
    expect(updatedField.lng).not.toBeNull();
    expect(Number(updatedField.lat)).toBeCloseTo(40.7506, 4);
    expect(Number(updatedField.lng)).toBeCloseTo(-73.9972, 4);
  });

  it("returns 404 (not crash) when geocoder fails for a zipcode-only field", async () => {
    await db
      .update(fieldsTable)
      .set({ lat: null, lng: null, zipcode: "99999" })
      .where(eq(fieldsTable.id, fieldId));

    fetchSpy.mockImplementation(async (input: RequestInfo | URL) => {
      const url = fetchInputToUrl(input);
      if (url.includes("geocoding-api.open-meteo.com")) {
        return new Response("upstream down", { status: 502 });
      }
      throw new Error(`weather should not have been called: ${url}`);
    });

    const res = await request(app).get(`/api/fields/${fieldId}/weather`);

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ message: "Field has no location set" });

    const fetchedUrls = fetchSpy.mock.calls.map((c) => fetchInputToUrl(c[0]));
    expect(fetchedUrls.some((u) => u.includes("geocoding-api.open-meteo.com"))).toBe(true);
    expect(fetchedUrls.some((u) => u.includes("api.open-meteo.com") && !u.includes("geocoding"))).toBe(false);

    // The route did not write a cache entry — there's no payload to cache yet.
    const [cached] = await db
      .select()
      .from(fieldWeatherCacheTable)
      .where(eq(fieldWeatherCacheTable.fieldId, fieldId));
    expect(cached).toBeUndefined();
  });

  it("deduplicates concurrent in-flight requests into a single upstream fetch", async () => {
    let resolveFetch: ((value: Response) => void) | undefined;
    const fetchPromise = new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    });
    let fetchCalledResolve: (() => void) | undefined;
    const fetchCalled = new Promise<void>((resolve) => {
      fetchCalledResolve = resolve;
    });

    fetchSpy.mockImplementation(() => {
      fetchCalledResolve?.();
      return fetchPromise;
    });

    // Calling .then() on a supertest Test actually fires the HTTP request.
    const req1 = request(app).get(`/api/fields/${fieldId}/weather`).then((r) => r);
    // Wait for the first request's upstream fetch to start before issuing the
    // second request, so the second one is guaranteed to attach to the
    // in-flight promise rather than start its own fetch.
    await fetchCalled;
    const req2 = request(app).get(`/api/fields/${fieldId}/weather`).then((r) => r);

    // Yield several microtasks so req2 reaches the route handler and checks
    // the inflight map before we resolve the upstream response.
    for (let i = 0; i < 20; i++) await Promise.resolve();

    expect(resolveFetch).toBeDefined();
    resolveFetch!(
      buildWeatherSuccessResponse({
        temperature: 71,
        weatherCode: 0,
        windGust: 7,
      }),
    );

    const [res1, res2] = await Promise.all([req1, req2]);

    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
    expect(res1.body).toMatchObject({
      temperatureF: 71,
      windGustMph: 7,
      weatherCode: 0,
      condition: "Clear",
    });
    expect(res2.body).toMatchObject({
      temperatureF: 71,
      windGustMph: 7,
      weatherCode: 0,
      condition: "Clear",
    });
    expect(res1.body.fetchedAt).toBe(res2.body.fetchedAt);

    expect(fetchSpy.mock.calls.length).toBe(1);
  });

  it("60-second negative cache prevents another upstream call during the window", async () => {
    fetchSpy.mockRejectedValue(new Error("upstream offline"));

    const first = await request(app).get(`/api/fields/${fieldId}/weather`);
    expect(first.status).toBe(502);
    const callsAfterFirst = fetchSpy.mock.calls.length;
    expect(callsAfterFirst).toBeGreaterThanOrEqual(1);

    // Subsequent requests within the 60s window must be served from the
    // negative cache and must NOT hit fetch again.
    const second = await request(app).get(`/api/fields/${fieldId}/weather`);
    expect(second.status).toBe(502);
    expect(second.body).toMatchObject({ message: "Weather provider unavailable" });

    const third = await request(app).get(`/api/fields/${fieldId}/weather`);
    expect(third.status).toBe(502);

    expect(fetchSpy.mock.calls.length).toBe(callsAfterFirst);

    // Sanity check: the cached row's expiresAt is within the 60s window.
    const [cached] = await db
      .select()
      .from(fieldWeatherCacheTable)
      .where(eq(fieldWeatherCacheTable.fieldId, fieldId));
    expect(cached).toBeDefined();
    expect(cached!.isError).toBe(true);
    const ttlMs = cached!.expiresAt.getTime() - Date.now();
    expect(ttlMs).toBeGreaterThan(0);
    expect(ttlMs).toBeLessThanOrEqual(60 * 1000);
  });
});

