import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { db } from "@workspace/db";
import { fieldsTable, adminClubMembershipsTable, fieldWeatherCacheTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth, requireClubAdmin, isSuperAdmin } from "../lib/auth";
import { invalidateMatchPreviewsForField } from "./match-previews";

const router: IRouter = Router();

function validateImageUrl(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") throw new Error("imageUrl must be a string");
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("/")) return trimmed;
  try {
    const u = new URL(trimmed);
    if (u.protocol !== "http:" && u.protocol !== "https:") {
      throw new Error("imageUrl must use http or https");
    }
    return trimmed;
  } catch {
    throw new Error("imageUrl must be a valid URL");
  }
}

async function requireFieldClubAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user) { res.status(401).json({ message: "Authentication required" }); return; }
  if (isSuperAdmin(req.user)) { next(); return; }
  const fieldId = String(req.params.fieldId);
  const [field] = await db.select().from(fieldsTable).where(eq(fieldsTable.id, fieldId));
  if (!field) { res.status(404).json({ message: "Field not found" }); return; }
  const memberships = await db.select().from(adminClubMembershipsTable).where(eq(adminClubMembershipsTable.userId, req.user.id));
  if (!memberships.some(m => m.clubId === field.clubId)) {
    res.status(403).json({ message: "Club admin access required to modify this field" }); return;
  }
  next();
}

router.get("/clubs/:clubId/fields", async (req, res) => {
  try {
    const clubId = String(req.params.clubId);
    const fields = await db.select().from(fieldsTable).where(eq(fieldsTable.clubId, clubId));
    res.json(fields);
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

router.post("/clubs/:clubId/fields", requireAuth, requireClubAdmin, async (req, res) => {
  try {
    const clubId = String(req.params.clubId);
    const { name, number, lat, lng, zipcode, imageUrl, surfaceType, isActive } = req.body;
    const safeImageUrl = validateImageUrl(imageUrl);
    const [field] = await db.insert(fieldsTable).values({
      clubId, name, number, lat, lng, zipcode, imageUrl: safeImageUrl, surfaceType, isActive,
    }).returning();
    res.status(201).json(field);
  } catch (e: any) {
    res.status(400).json({ message: e.message });
  }
});

router.put("/fields/:fieldId", requireAuth, requireFieldClubAdmin, async (req, res) => {
  try {
    const fieldId = String(req.params.fieldId);
    const { name, number, lat, lng, zipcode, imageUrl, surfaceType, isActive } = req.body;
    const updates: Record<string, any> = {};
    if (name !== undefined) updates.name = name;
    if (number !== undefined) updates.number = number;
    if (lat !== undefined) updates.lat = lat;
    if (lng !== undefined) updates.lng = lng;
    if (zipcode !== undefined) updates.zipcode = zipcode;
    if (imageUrl !== undefined) updates.imageUrl = validateImageUrl(imageUrl);
    if (surfaceType !== undefined) updates.surfaceType = surfaceType;
    if (isActive !== undefined) updates.isActive = isActive;
    const [field] = await db.update(fieldsTable).set(updates).where(eq(fieldsTable.id, fieldId)).returning();
    // Field name renders on the BoldDiagonal OG preview card (location row),
    // so a rename invalidates every match on this field. Auto-backfill on
    // the next admin page mount produces fresh PNGs.
    if (updates.name !== undefined) {
      await invalidateMatchPreviewsForField(fieldId).catch(() => { /* don't block edit */ });
    }
    res.json(field);
  } catch (e: any) {
    res.status(400).json({ message: e.message });
  }
});

router.delete("/fields/:fieldId", requireAuth, requireFieldClubAdmin, async (req, res) => {
  try {
    const fieldId = String(req.params.fieldId);
    await db.delete(fieldsTable).where(eq(fieldsTable.id, fieldId));
    res.json({ message: "Field deleted" });
  } catch (e: any) {
    res.status(400).json({ message: e.message });
  }
});

const WEATHER_TTL_MS = 5 * 60 * 1000;
const WEATHER_ERROR_TTL_MS = 60 * 1000;

interface WeatherPayload {
  temperatureF: number | null;
  windGustMph: number | null;
  weatherCode: number | null;
  condition: string | null;
  timezone: string | null;
  fetchedAt: string;
}

interface WeatherResponse extends WeatherPayload {
  stale?: boolean;
}

interface WeatherErrorPayload {
  statusCode: number;
  message: string;
  fetchedAt: string;
}

class HttpError extends Error {
  statusCode: number;
  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}

type WeatherFetchResult =
  | { ok: true; payload: WeatherPayload }
  | { ok: false; statusCode: number; message: string; lastSuccess: WeatherPayload | null };

const inflightWeather = new Map<string, Promise<WeatherFetchResult>>();

function extractLastSuccess(value: unknown): WeatherPayload | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Partial<WeatherPayload>;
  if (typeof v.fetchedAt !== "string") return null;
  return {
    temperatureF: typeof v.temperatureF === "number" ? v.temperatureF : null,
    windGustMph: typeof v.windGustMph === "number" ? v.windGustMph : null,
    weatherCode: typeof v.weatherCode === "number" ? v.weatherCode : null,
    condition: typeof v.condition === "string" ? v.condition : null,
    timezone: typeof v.timezone === "string" ? v.timezone : null,
    fetchedAt: v.fetchedAt,
  };
}

async function cacheWeatherError(fieldId: string, statusCode: number, message: string): Promise<WeatherPayload | null> {
  const payload: WeatherErrorPayload = {
    statusCode,
    message,
    fetchedAt: new Date().toISOString(),
  };
  const expiresAt = new Date(Date.now() + WEATHER_ERROR_TTL_MS);
  let lastSuccess: WeatherPayload | null = null;
  try {
    const [existing] = await db
      .select()
      .from(fieldWeatherCacheTable)
      .where(eq(fieldWeatherCacheTable.fieldId, fieldId));
    if (existing) {
      lastSuccess = existing.isError
        ? extractLastSuccess(existing.lastSuccessPayload)
        : extractLastSuccess(existing.payload);
    }
  } catch {
    // Read failure shouldn't prevent us from writing the negative cache entry.
  }
  try {
    await db
      .insert(fieldWeatherCacheTable)
      .values({ fieldId, payload, isError: true, expiresAt, updatedAt: new Date(), lastSuccessPayload: lastSuccess })
      .onConflictDoUpdate({
        target: fieldWeatherCacheTable.fieldId,
        set: { payload, isError: true, expiresAt, updatedAt: new Date(), lastSuccessPayload: lastSuccess },
      });
  } catch {
    // Swallow cache write errors so we still surface the original failure to the caller.
  }
  return lastSuccess;
}

const WEATHER_CODE_TO_LABEL: Record<number, string> = {
  0: "Clear",
  1: "Mostly Clear",
  2: "Partly Cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Fog",
  51: "Light Drizzle",
  53: "Drizzle",
  55: "Heavy Drizzle",
  61: "Light Rain",
  63: "Rain",
  65: "Heavy Rain",
  66: "Freezing Rain",
  67: "Freezing Rain",
  71: "Light Snow",
  73: "Snow",
  75: "Heavy Snow",
  77: "Snow Grains",
  80: "Light Showers",
  81: "Showers",
  82: "Violent Showers",
  85: "Snow Showers",
  86: "Heavy Snow Showers",
  95: "Thunderstorm",
  96: "Thunderstorm w/ Hail",
  99: "Thunderstorm w/ Hail",
};

async function geocodeZip(zip: string): Promise<{ lat: number; lng: number } | null> {
  const trimmed = zip.trim();
  // Try zippopotam.us first — it's a proper postal-code geocoder.
  // Open-Meteo's "name=" search treats ZIPs as text and matches loosely
  // (e.g. US ZIP 33414 wrongly resolves to Avilés, Spain).
  const us5 = /^\d{5}$/.test(trimmed) ? trimmed : null;
  if (us5) {
    try {
      const r = await fetch(`https://api.zippopotam.us/us/${us5}`);
      if (r.ok) {
        const j: any = await r.json();
        const place = j?.places?.[0];
        if (place && place.latitude && place.longitude) {
          const lat = Number(place.latitude);
          const lng = Number(place.longitude);
          if (!Number.isNaN(lat) && !Number.isNaN(lng)) return { lat, lng };
        }
      }
    } catch {
      // fall through
    }
  }
  // Fallback: Open-Meteo geocoding (handles non-US postal codes / city names)
  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(trimmed)}&count=1&language=en&format=json`;
    const r = await fetch(url);
    if (!r.ok) return null;
    const j: any = await r.json();
    const first = j?.results?.[0];
    if (!first) return null;
    const lat = Number(first.latitude);
    const lng = Number(first.longitude);
    if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
    return { lat, lng };
  } catch {
    return null;
  }
}

async function fetchAndCacheWeather(fieldId: string): Promise<WeatherFetchResult> {
  const [field] = await db.select().from(fieldsTable).where(eq(fieldsTable.id, fieldId));
  if (!field) {
    throw new HttpError(404, "Field not found");
  }

  let lat = field.lat ? Number(field.lat) : null;
  let lng = field.lng ? Number(field.lng) : null;

  if ((lat === null || lng === null || Number.isNaN(lat) || Number.isNaN(lng)) && field.zipcode) {
    const geo = await geocodeZip(field.zipcode.trim());
    if (geo) {
      lat = geo.lat;
      lng = geo.lng;
      await db.update(fieldsTable).set({ lat: String(geo.lat), lng: String(geo.lng) }).where(eq(fieldsTable.id, fieldId));
    }
  }

  if (lat === null || lng === null || Number.isNaN(lat) || Number.isNaN(lng)) {
    throw new HttpError(404, "Field has no location set");
  }

  const failure = async (): Promise<WeatherFetchResult> => {
    const lastSuccess = await cacheWeatherError(fieldId, 502, "Weather provider unavailable");
    return { ok: false, statusCode: 502, message: "Weather provider unavailable", lastSuccess };
  };

  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,weather_code,wind_gusts_10m&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=auto`;
  let r: Awaited<ReturnType<typeof fetch>>;
  try {
    r = await fetch(url);
  } catch {
    return failure();
  }
  if (!r.ok) {
    return failure();
  }
  let j: any;
  try {
    j = await r.json();
  } catch {
    return failure();
  }
  const cur = j?.current ?? {};
  const code = typeof cur.weather_code === "number" ? cur.weather_code : null;
  const payload: WeatherPayload = {
    temperatureF: typeof cur.temperature_2m === "number" ? Math.round(cur.temperature_2m) : null,
    windGustMph: typeof cur.wind_gusts_10m === "number" ? Math.round(cur.wind_gusts_10m) : null,
    weatherCode: code,
    condition: code !== null ? (WEATHER_CODE_TO_LABEL[code] || "—") : null,
    timezone: typeof j?.timezone === "string" ? j.timezone : null,
    fetchedAt: new Date().toISOString(),
  };

  const expiresAt = new Date(Date.now() + WEATHER_TTL_MS);
  await db
    .insert(fieldWeatherCacheTable)
    .values({ fieldId, payload, isError: false, expiresAt, updatedAt: new Date(), lastSuccessPayload: payload })
    .onConflictDoUpdate({
      target: fieldWeatherCacheTable.fieldId,
      set: { payload, isError: false, expiresAt, updatedAt: new Date(), lastSuccessPayload: payload },
    });

  return { ok: true, payload };
}

router.get("/fields/:fieldId/weather", async (req, res) => {
  try {
    const fieldId = String(req.params.fieldId);

    const [cached] = await db
      .select()
      .from(fieldWeatherCacheTable)
      .where(eq(fieldWeatherCacheTable.fieldId, fieldId));
    if (cached && cached.expiresAt.getTime() > Date.now()) {
      if (cached.isError) {
        const lastSuccess = extractLastSuccess(cached.lastSuccessPayload);
        if (lastSuccess) {
          const stale: WeatherResponse = { ...lastSuccess, stale: true };
          res.json(stale);
          return;
        }
        const errPayload = (cached.payload ?? {}) as Partial<WeatherErrorPayload>;
        const status = typeof errPayload.statusCode === "number" ? errPayload.statusCode : 502;
        const message = typeof errPayload.message === "string" && errPayload.message
          ? errPayload.message
          : "Weather provider unavailable";
        res.status(status).json({ message });
        return;
      }
      res.json(cached.payload as WeatherPayload);
      return;
    }

    let inflight = inflightWeather.get(fieldId);
    if (!inflight) {
      inflight = fetchAndCacheWeather(fieldId).finally(() => {
        inflightWeather.delete(fieldId);
      });
      inflightWeather.set(fieldId, inflight);
    }

    const result = await inflight;
    if (result.ok) {
      res.json(result.payload);
      return;
    }
    if (result.lastSuccess) {
      const stale: WeatherResponse = { ...result.lastSuccess, stale: true };
      res.json(stale);
      return;
    }
    res.status(result.statusCode).json({ message: result.message });
  } catch (e: unknown) {
    const status = e instanceof HttpError ? e.statusCode : 500;
    const message = e instanceof Error ? e.message : "Unknown error";
    res.status(status).json({ message });
  }
});

export default router;
