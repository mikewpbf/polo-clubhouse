// Task #121 (step 3): expose the existing openapi.yaml plus a Redoc-rendered
// HTML docs page. We don't rewrite the spec — just serve the file that
// already lives in lib/api-spec/openapi.yaml. The file location is resolved
// from a couple of candidate paths so it works in both `pnpm dev` (sources
// in lib/api-spec/) and the bundled production build.
import { Router, type IRouter } from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, readFileSync } from "node:fs";

const router: IRouter = Router();

function resolveSpecPath(): string | null {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    // Source-tree dev path
    path.resolve(here, "..", "..", "..", "..", "lib", "api-spec", "openapi.yaml"),
    // Bundled production fallback (if build copies it next to the bundle)
    path.resolve(here, "openapi.yaml"),
    path.resolve(here, "..", "openapi.yaml"),
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return null;
}

let cachedYaml: string | null = null;
function loadSpec(): string | null {
  if (cachedYaml) return cachedYaml;
  const p = resolveSpecPath();
  if (!p) return null;
  try {
    cachedYaml = readFileSync(p, "utf-8");
    return cachedYaml;
  } catch {
    return null;
  }
}

router.get("/openapi.yaml", (_req, res) => {
  const spec = loadSpec();
  if (!spec) { res.status(404).json({ message: "OpenAPI spec not bundled with this build" }); return; }
  res.setHeader("Content-Type", "application/yaml; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=300");
  res.send(spec);
});

// Lightweight Redoc page — pulled from a CDN so we don't ship the bundle.
// Mobile/TV teams point Postman / Stoplight / their codegen at /api/openapi.yaml
// directly; this page is for human exploration.
router.get("/docs", (_req, res) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Polo Manager API — Docs</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="icon" href="data:," />
    <style>body { margin: 0; padding: 0; }</style>
  </head>
  <body>
    <redoc spec-url="/api/openapi.yaml"></redoc>
    <script src="https://cdn.redoc.ly/redoc/latest/bundles/redoc.standalone.js"></script>
  </body>
</html>`);
});

export default router;
