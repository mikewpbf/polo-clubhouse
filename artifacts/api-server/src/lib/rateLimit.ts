// Task #121 (step 8): per-IP / per-user / per-API-key rate limiting.
// Limits are intentionally generous so they don't disrupt current usage of
// the web app; they exist so a misbehaving native client can't flood the API.
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import type { Request } from "express";
import { findActiveApiKey } from "./apiKeys";

declare global {
  namespace Express {
    interface Request {
      apiKeyId?: string;
      apiKeyClientKind?: string;
    }
  }
}

const WINDOW_MS = 60 * 1000;

// 60 req/min for unauthenticated traffic per IP.
export const unauthRateLimiter = rateLimit({
  windowMs: WINDOW_MS,
  limit: 60,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  // Skip if we recognize a user or API-key — those have their own buckets.
  skip: (req: Request) => Boolean(req.user || req.apiKeyId),
  keyGenerator: (req: Request) => ipKeyGenerator(req.ip ?? ""),
  message: { message: "Too many requests, please try again later." },
});

// 600 req/min per authenticated user.
export const userRateLimiter = rateLimit({
  windowMs: WINDOW_MS,
  limit: 600,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  skip: (req: Request) => !req.user,
  keyGenerator: (req: Request) => `user:${req.user!.id}`,
  message: { message: "Too many requests for this user." },
});

// 6000 req/min per API key.
export const apiKeyRateLimiter = rateLimit({
  windowMs: WINDOW_MS,
  limit: 6000,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  skip: (req: Request) => !req.apiKeyId,
  keyGenerator: (req: Request) => `apikey:${req.apiKeyId}`,
  message: { message: "Too many requests for this API key." },
});

// Lookup the API key from `x-api-key` header and stamp it on the request.
// Does NOT enforce — middleware further down (or a route) can require it.
export async function attachApiKey(req: Request, _res: any, next: any) {
  const raw = req.header("x-api-key");
  if (raw) {
    const row = await findActiveApiKey(raw).catch(() => null);
    if (row) {
      req.apiKeyId = row.id;
      req.apiKeyClientKind = row.clientKind;
    }
  }
  next();
}
