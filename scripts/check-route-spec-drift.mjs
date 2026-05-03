#!/usr/bin/env node
// Task #121 (step 3): CI-style route ↔ OpenAPI spec drift check.
//
// Walks every Express `router.<method>(...)` declaration in
// artifacts/api-server/src/routes/*.ts and ensures each (METHOD, PATH) pair
// is represented in lib/api-spec/openapi.yaml. Fails with a non-zero exit
// code (and a list of missing entries) if the spec is out of date.
//
// Routes can opt out by appending a trailing comment `// no-spec: <reason>`
// on the same line as the `router.<method>(...)` call. Use sparingly —
// public-facing endpoints should always be in the spec.

import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const ROUTES_DIR = join(ROOT, "artifacts", "api-server", "src", "routes");
const SPEC_PATH = join(ROOT, "lib", "api-spec", "openapi.yaml");
const BASELINE_PATH = join(__dirname, "route-spec-drift-baseline.txt");

const METHODS = ["get", "post", "put", "patch", "delete"];
const ROUTE_RE = new RegExp(
  `router\\.(${METHODS.join("|")})\\(\\s*["\`]([^"\`]+)["\`]`,
  "g",
);
const OPT_OUT_RE = /\/\/\s*no-spec\b/;

function listRouteFiles() {
  return readdirSync(ROUTES_DIR)
    .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"))
    .map((f) => join(ROUTES_DIR, f));
}

function extractRoutes() {
  const found = [];
  for (const file of listRouteFiles()) {
    const src = readFileSync(file, "utf8");
    const lines = src.split("\n");
    for (const line of lines) {
      if (OPT_OUT_RE.test(line)) continue;
      ROUTE_RE.lastIndex = 0;
      let m;
      while ((m = ROUTE_RE.exec(line)) !== null) {
        found.push({
          method: m[1].toLowerCase(),
          path: normalizePath(m[2]),
          file: file.replace(ROOT + "/", ""),
        });
      }
    }
  }
  return found;
}

// Convert Express `:param` to OpenAPI `{param}`; strip query strings.
function normalizePath(p) {
  return p
    .replace(/\?.*$/, "")
    .replace(/:([A-Za-z0-9_]+)/g, (_, n) => `{${n}}`);
}

// Minimal YAML walker for the `paths:` section. Avoids a runtime dep so the
// drift check can run from the repo root without npm install. Looks for
// 2-space-indented path keys and 4-space-indented method keys under them.
function loadSpecPaths() {
  const text = readFileSync(SPEC_PATH, "utf8");
  const lines = text.split("\n");
  const set = new Set();
  let inPaths = false;
  let currentPath = null;
  for (const raw of lines) {
    if (/^[A-Za-z_-]+:/.test(raw)) {
      inPaths = raw.startsWith("paths:");
      currentPath = null;
      continue;
    }
    if (!inPaths) continue;
    const m2 = raw.match(/^ {2}(\/[^:]*):\s*$/);
    if (m2) { currentPath = m2[1].trim(); continue; }
    const m4 = raw.match(/^ {4}([a-z]+):\s*$/);
    if (m4 && currentPath && METHODS.includes(m4[1])) {
      set.add(`${m4[1]} ${currentPath}`);
    }
  }
  return set;
}

function loadBaseline() {
  try {
    return new Set(
      readFileSync(BASELINE_PATH, "utf8")
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith("#"))
        .map((l) => {
          const [method, path] = l.split(/\s+/);
          return `${method.toLowerCase()} ${path}`;
        }),
    );
  } catch { return new Set(); }
}

const routes = extractRoutes();
const spec = loadSpecPaths();
const baseline = loadBaseline();

const missing = [];
const stale = new Set(baseline);
for (const r of routes) {
  const key = `${r.method} ${r.path}`;
  stale.delete(key);
  if (spec.has(key) || baseline.has(key)) continue;
  missing.push({ ...r, key });
}

if (stale.size > 0) {
  console.error("\n⚠️  scripts/route-spec-drift-baseline.txt contains entries that no longer match any route:");
  for (const k of stale) console.error(`  ${k}`);
  console.error("Remove them from the baseline file.\n");
  process.exit(1);
}

if (missing.length > 0) {
  console.error("\n❌ Route ↔ OpenAPI drift detected.\n");
  console.error("The following Express routes are not declared in lib/api-spec/openapi.yaml:");
  for (const m of missing) {
    console.error(`  ${m.method.toUpperCase().padEnd(6)} ${m.path}    (${m.file})`);
  }
  console.error(
    "\nAdd a matching entry to the spec (or append `// no-spec: <reason>` to the route line if it's intentionally undocumented).\n",
  );
  process.exit(1);
}

console.log(`✓ All ${routes.length} Express routes are present in the OpenAPI spec.`);
