import { S3Client } from "@aws-sdk/client-s3";

interface R2Config {
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
}

let _config: R2Config | null = null;
let _client: S3Client | null = null;

export function getR2Config(): R2Config {
  if (_config) return _config;
  const endpoint = process.env.R2_ENDPOINT;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET;
  const missing = [
    !endpoint && "R2_ENDPOINT",
    !accessKeyId && "R2_ACCESS_KEY_ID",
    !secretAccessKey && "R2_SECRET_ACCESS_KEY",
    !bucket && "R2_BUCKET",
  ].filter(Boolean) as string[];
  if (missing.length > 0) {
    throw new Error(`R2 storage env vars missing: ${missing.join(", ")}`);
  }
  _config = {
    endpoint: endpoint!,
    accessKeyId: accessKeyId!,
    secretAccessKey: secretAccessKey!,
    bucket: bucket!,
  };
  return _config;
}

export function getR2Client(): S3Client {
  if (_client) return _client;
  const cfg = getR2Config();
  _client = new S3Client({
    region: "auto",
    endpoint: cfg.endpoint,
    credentials: {
      accessKeyId: cfg.accessKeyId,
      secretAccessKey: cfg.secretAccessKey,
    },
    forcePathStyle: true,
  });
  return _client;
}
