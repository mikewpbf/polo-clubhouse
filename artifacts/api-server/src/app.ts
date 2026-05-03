import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import router from "./routes";
import { logger } from "./lib/logger";
import { ogMetaMiddleware, spaOgInjectionMiddleware } from "./lib/og-meta";
import { attachApiKey, unauthRateLimiter, userRateLimiter, apiKeyRateLimiter } from "./lib/rateLimit";
import { optionalAuth } from "./lib/auth";

const app: Express = express();

// Trust the deployment proxy so `req.protocol` reflects X-Forwarded-Proto.
// Without this, OG link-preview URLs (og:url / og:image) come out as
// `http://` even when the page is served over HTTPS, which causes iMessage,
// WhatsApp, and other chat apps to drop the preview image due to mixed
// content. Replit Autoscale and similar single-hop reverse proxies are safe
// to fully trust here.
app.set("trust proxy", true);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Task #121 (step 1): versioned alias. We rewrite `/api/v1/*` to `/api/*`
// BEFORE the main `/api` mount, so both prefixes hit the same router and
// middleware chain exactly once (no double rate-limiting). `/api/v1` is the
// canonical path documented for new clients; `/api` stays mounted for
// backward compatibility.
app.use((req, _res, next) => {
  if (req.url.startsWith("/api/v1/") || req.url === "/api/v1") {
    req.url = "/api" + req.url.slice("/api/v1".length);
  }
  next();
});

// Task #121 (step 8): rate limiting. Attach the optional auth user + API key
// first so the limiter can choose the right bucket per request.
app.use("/api", optionalAuth, attachApiKey, unauthRateLimiter, userRateLimiter, apiKeyRateLimiter, router);

// In production the bundled api-server also serves the polo-manager SPA.
// build.mjs copies polo-manager/dist/public into api-server/dist/public,
// so at runtime the static dir sits next to the bundle.
//
// The OG SSR middleware is mounted unconditionally in production so chat
// crawlers still get a valid link-preview card even on a partial deploy
// where the SPA bundle failed to copy. Only the static-file serving and
// the SPA catch-all are gated on the static dir actually existing — in
// the degraded state humans see a 404 on app routes instead of every
// shared link rendering with no preview at all.
if (process.env.NODE_ENV === "production") {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const staticDir = path.resolve(__dirname, "public");

  // ogMetaMiddleware is the bot-only fast path that returns a bare-bones
  // OG HTML response — kept as a fallback so scrapers still get a card
  // even on a degraded deploy where the SPA bundle didn't copy.
  app.use(ogMetaMiddleware);

  if (existsSync(staticDir)) {
    // SPA-OG injection: for HTML navigations on OG-eligible paths, splice
    // OG/Twitter meta tags into the SPA's index.html for *every* client.
    // This is what makes iMessage / Apple LinkPresentation render the
    // proper match preview instead of the generic site card — those
    // clients use a vanilla Safari UA that the bot regex can't match.
    // Mounted BEFORE express.static so the catch-all index.html serve
    // never wins for these paths.
    app.use(spaOgInjectionMiddleware(staticDir));

    app.use(express.static(staticDir));
    app.get("/*splat", (req: Request, res: Response, next: NextFunction) => {
      // Anything under /api is the API surface — let the router 404 it as JSON.
      if (req.path.startsWith("/api/") || req.path === "/api") return next();
      res.sendFile(path.join(staticDir, "index.html"));
    });
  } else {
    logger.warn(
      { staticDir },
      "Static SPA dir not found alongside bundle; running API-only with OG previews still active.",
    );
  }
}

export default app;
