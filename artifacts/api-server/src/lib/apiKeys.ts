// Task #121 (step 8): API keys for future native clients (iOS / tvOS / Android
// / OBS bridges). The current web app is grandfathered in without a key —
// requests that don't carry an `x-api-key` header are still served.
import crypto from "node:crypto";
import { db } from "@workspace/db";
import { apiKeysTable } from "@workspace/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import type { ClientKind } from "./config";

const KEY_PREFIX = "pk_";

export function hashApiKey(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

export function generateApiKey(): { raw: string; prefix: string } {
  const random = crypto.randomBytes(24).toString("base64url");
  const raw = `${KEY_PREFIX}${random}`;
  return { raw, prefix: raw.slice(0, 10) };
}

export async function createApiKey(opts: { clientName: string; clientKind: ClientKind; createdBy?: string }) {
  const { raw, prefix } = generateApiKey();
  const [row] = await db.insert(apiKeysTable).values({
    clientName: opts.clientName,
    clientKind: opts.clientKind,
    keyHash: hashApiKey(raw),
    keyPrefix: prefix,
    createdBy: opts.createdBy ?? null,
  }).returning();
  // Raw key is returned exactly once — never persisted.
  return { id: row.id, key: raw, prefix, clientName: row.clientName, clientKind: row.clientKind, createdAt: row.createdAt };
}

export async function listApiKeys() {
  const rows = await db.select().from(apiKeysTable);
  return rows.map(r => ({
    id: r.id,
    clientName: r.clientName,
    clientKind: r.clientKind,
    keyPrefix: r.keyPrefix,
    createdAt: r.createdAt,
    revokedAt: r.revokedAt,
  }));
}

export async function revokeApiKey(id: string): Promise<boolean> {
  const result = await db.update(apiKeysTable)
    .set({ revokedAt: new Date() })
    .where(and(eq(apiKeysTable.id, id), isNull(apiKeysTable.revokedAt)))
    .returning({ id: apiKeysTable.id });
  return result.length > 0;
}

export async function findActiveApiKey(raw: string) {
  if (!raw || !raw.startsWith(KEY_PREFIX)) return null;
  const [row] = await db.select().from(apiKeysTable).where(
    and(eq(apiKeysTable.keyHash, hashApiKey(raw)), isNull(apiKeysTable.revokedAt)),
  );
  return row || null;
}
