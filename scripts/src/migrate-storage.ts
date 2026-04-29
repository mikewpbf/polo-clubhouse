// One-time migration: copy all uploaded images from the source deployment
// (typically the still-running Replit instance) into a Cloudflare R2 bucket.
//
// Required env vars:
//   DATABASE_URL              Postgres connection string (the live Render DB)
//   SOURCE_BASE_URL           Base URL of the source (e.g. https://my-app.replit.dev)
//   R2_ENDPOINT               R2 S3-API endpoint
//   R2_BUCKET                 R2 bucket name
//   R2_ACCESS_KEY_ID          R2 access key id
//   R2_SECRET_ACCESS_KEY      R2 secret
//
// Optional:
//   CONCURRENCY               Parallelism (default 5)
//   DRY_RUN=1                 List what would be copied without doing it
//
// Usage from repo root:
//   pnpm --filter @workspace/scripts migrate-storage

import { Client } from "pg";
import {
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

interface ImageRow {
  table: string;
  column: string;
  id: string;
  url: string;
}

const TARGETS: Array<{ table: string; column: string }> = [
  { table: "players", column: "headshot_url" },
  { table: "clubs", column: "logo_url" },
  { table: "teams", column: "logo_url" },
  { table: "users", column: "avatar_url" },
  { table: "fields", column: "image_url" },
];

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing required env var: ${name}`);
    process.exit(1);
  }
  return v;
}

async function fetchAllRows(db: Client): Promise<ImageRow[]> {
  const rows: ImageRow[] = [];
  for (const { table, column } of TARGETS) {
    const sql = `SELECT id, ${column} AS url FROM ${table} WHERE ${column} IS NOT NULL AND ${column} <> ''`;
    const res = await db.query<{ id: string; url: string }>(sql);
    for (const r of res.rows) {
      rows.push({ table, column, id: r.id, url: r.url });
    }
  }
  return rows;
}

// Convert a stored URL into the R2 object key.
// Accepts:
//   /api/storage/objects/<key>     -> <key>
//   /objects/<key>                 -> <key>
//   <absolute URL>/api/storage/... -> <key>
// Returns null if the URL doesn't look like one of ours.
function urlToKey(url: string): string | null {
  let path = url;
  try {
    const u = new URL(url);
    path = u.pathname;
  } catch {
    // not absolute — already a path
  }
  const apiPrefix = "/api/storage/objects/";
  const objPrefix = "/objects/";
  if (path.startsWith(apiPrefix)) return path.slice(apiPrefix.length);
  if (path.startsWith(objPrefix)) return path.slice(objPrefix.length);
  return null;
}

function buildSourceUrl(base: string, key: string): string {
  const trimmed = base.endsWith("/") ? base.slice(0, -1) : base;
  return `${trimmed}/api/storage/objects/${key}`;
}

async function alreadyInR2(
  s3: S3Client,
  bucket: string,
  key: string,
): Promise<boolean> {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch (err) {
    const e = err as { $metadata?: { httpStatusCode?: number }; name?: string };
    if (e.$metadata?.httpStatusCode === 404 || e.name === "NotFound") {
      return false;
    }
    throw err;
  }
}

async function copyOne(
  s3: S3Client,
  bucket: string,
  sourceBase: string,
  row: ImageRow,
  dryRun: boolean,
): Promise<"copied" | "skipped" | "failed" | "missing-source"> {
  const key = urlToKey(row.url);
  if (!key) {
    console.warn(
      `[skip-unparsed] ${row.table}.${row.column} id=${row.id}: ${row.url}`,
    );
    return "skipped";
  }

  if (await alreadyInR2(s3, bucket, key)) {
    console.log(`[exists]  ${key}`);
    return "skipped";
  }

  if (dryRun) {
    console.log(`[dry-run] would copy ${key}`);
    return "copied";
  }

  const sourceUrl = buildSourceUrl(sourceBase, key);
  const res = await fetch(sourceUrl);
  if (!res.ok) {
    console.error(
      `[fail]    ${key} — source returned ${res.status} (${sourceUrl})`,
    );
    return res.status === 404 ? "missing-source" : "failed";
  }

  const contentType =
    res.headers.get("content-type") ?? "application/octet-stream";
  const buf = Buffer.from(await res.arrayBuffer());

  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buf,
      ContentType: contentType,
    }),
  );
  console.log(`[copy]    ${key} (${buf.byteLength} bytes, ${contentType})`);
  return "copied";
}

async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  async function next(): Promise<void> {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      results[i] = await worker(items[i]!);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => next()),
  );
  return results;
}

async function main() {
  const databaseUrl = requireEnv("DATABASE_URL");
  const sourceBase = requireEnv("SOURCE_BASE_URL");
  const endpoint = requireEnv("R2_ENDPOINT");
  const bucket = requireEnv("R2_BUCKET");
  const accessKeyId = requireEnv("R2_ACCESS_KEY_ID");
  const secretAccessKey = requireEnv("R2_SECRET_ACCESS_KEY");
  const concurrency = parseInt(process.env.CONCURRENCY ?? "5", 10);
  const dryRun = process.env.DRY_RUN === "1";

  const s3 = new S3Client({
    region: "auto",
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true,
  });

  const db = new Client({ connectionString: databaseUrl });
  await db.connect();

  console.log(`Source : ${sourceBase}`);
  console.log(`Bucket : ${bucket}`);
  console.log(`Mode   : ${dryRun ? "DRY RUN" : "live"}`);
  console.log(`Workers: ${concurrency}`);
  console.log("");

  const rows = await fetchAllRows(db);
  console.log(`Found ${rows.length} URL rows across ${TARGETS.length} tables`);

  const results = await runWithConcurrency(rows, concurrency, (row) =>
    copyOne(s3, bucket, sourceBase, row, dryRun).catch((err) => {
      console.error(
        `[fail]    ${row.table}.${row.column} id=${row.id}: ${(err as Error).message}`,
      );
      return "failed" as const;
    }),
  );

  const tally = results.reduce<Record<string, number>>((acc, r) => {
    acc[r] = (acc[r] ?? 0) + 1;
    return acc;
  }, {});
  console.log("");
  console.log("Summary:", tally);

  await db.end();

  if ((tally.failed ?? 0) > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
