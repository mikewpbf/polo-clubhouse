import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import router from "./routes";
import { logger } from "./lib/logger";
import { ogMetaMiddleware } from "./lib/og-meta";

const app: Express = express();

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

app.use("/api", router);

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

  app.use(ogMetaMiddleware);

  if (existsSync(staticDir)) {
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
