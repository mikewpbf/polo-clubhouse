import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Readable } from "stream";
import { randomUUID } from "crypto";
import {
  ObjectAclPolicy,
  ObjectPermission,
  StoredObject,
  canAccessObject,
  getObjectAclPolicy,
  setObjectAclPolicy,
} from "./objectAcl";
import { getR2Client, getR2Config } from "./r2Client";

const PUBLIC_PREFIX = "public/";
const UPLOAD_PREFIX = "uploads/";

export type { StoredObject };

export class ObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

export class ObjectStorageService {
  constructor() {}

  async searchPublicObject(filePath: string): Promise<StoredObject | null> {
    const cfg = getR2Config();
    const key = `${PUBLIC_PREFIX}${filePath}`;
    try {
      await getR2Client().send(
        new HeadObjectCommand({ Bucket: cfg.bucket, Key: key }),
      );
      return { bucket: cfg.bucket, key };
    } catch (err) {
      if (isNotFoundError(err)) return null;
      throw err;
    }
  }

  async downloadObject(
    obj: StoredObject,
    cacheTtlSec: number = 3600,
  ): Promise<Response> {
    const aclPolicy = await getObjectAclPolicy(obj);
    const isPublic = aclPolicy?.visibility === "public";

    const result = await getR2Client().send(
      new GetObjectCommand({ Bucket: obj.bucket, Key: obj.key }),
    );

    const headers: Record<string, string> = {
      "Content-Type": result.ContentType ?? "application/octet-stream",
      "Cache-Control": `${isPublic ? "public" : "private"}, max-age=${cacheTtlSec}`,
    };
    if (typeof result.ContentLength === "number") {
      headers["Content-Length"] = String(result.ContentLength);
    }

    if (!result.Body) {
      return new Response(null, { headers });
    }

    const nodeStream = result.Body as Readable;
    const webStream = Readable.toWeb(nodeStream) as ReadableStream;
    return new Response(webStream, { headers });
  }

  async getObjectEntityUploadURL(): Promise<string> {
    const cfg = getR2Config();
    const objectId = randomUUID();
    const key = `${UPLOAD_PREFIX}${objectId}`;

    return getSignedUrl(
      getR2Client(),
      new PutObjectCommand({ Bucket: cfg.bucket, Key: key }),
      { expiresIn: 900 },
    );
  }

  async getObjectEntityFile(objectPath: string): Promise<StoredObject> {
    if (!objectPath.startsWith("/objects/")) {
      throw new ObjectNotFoundError();
    }
    const entityId = objectPath.slice("/objects/".length);
    if (!entityId) {
      throw new ObjectNotFoundError();
    }
    const cfg = getR2Config();
    try {
      await getR2Client().send(
        new HeadObjectCommand({ Bucket: cfg.bucket, Key: entityId }),
      );
      return { bucket: cfg.bucket, key: entityId };
    } catch (err) {
      if (isNotFoundError(err)) throw new ObjectNotFoundError();
      throw err;
    }
  }

  // Translate the various incoming forms we see for a stored object into the
  // canonical "/objects/<key>" form persisted on entity rows.
  // Inputs we accept:
  //  - presigned PUT URL (R2 host) — extract /uploads/<uuid> from the path
  //  - already-normalized "/objects/<key>" path
  //  - "/api/storage/objects/<key>" (the public API URL) — strip the API prefix
  normalizeObjectEntityPath(rawPath: string): string {
    if (rawPath.startsWith("/objects/")) return rawPath;
    if (rawPath.startsWith("/api/storage/objects/")) {
      return rawPath.slice("/api/storage".length);
    }

    try {
      const url = new URL(rawPath);
      const segments = url.pathname.split("/").filter(Boolean);
      // For path-style R2: /<bucket>/<key…>; for virtual-host: /<key…>
      const cfg = getR2Config();
      let keyParts = segments;
      if (segments[0] === cfg.bucket) {
        keyParts = segments.slice(1);
      }
      const key = keyParts.join("/");
      if (key.startsWith(UPLOAD_PREFIX) || key.startsWith(PUBLIC_PREFIX)) {
        return `/objects/${key}`;
      }
    } catch {
      // not a URL — fall through
    }

    return rawPath;
  }

  async trySetObjectEntityAclPolicy(
    rawPath: string,
    aclPolicy: ObjectAclPolicy,
  ): Promise<string> {
    const normalizedPath = this.normalizeObjectEntityPath(rawPath);
    if (!normalizedPath.startsWith("/")) {
      return normalizedPath;
    }

    const objectFile = await this.getObjectEntityFile(normalizedPath);
    await setObjectAclPolicy(objectFile, aclPolicy);
    return normalizedPath;
  }

  async canAccessObjectEntity({
    userId,
    objectFile,
    requestedPermission,
  }: {
    userId?: string;
    objectFile: StoredObject;
    requestedPermission?: ObjectPermission;
  }): Promise<boolean> {
    return canAccessObject({
      userId,
      objectFile,
      requestedPermission: requestedPermission ?? ObjectPermission.READ,
    });
  }
}

function isNotFoundError(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const e = err as { name?: string; $metadata?: { httpStatusCode?: number } };
  return e.name === "NotFound" || e.$metadata?.httpStatusCode === 404;
}
