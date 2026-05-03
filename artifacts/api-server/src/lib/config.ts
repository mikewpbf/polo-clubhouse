// Task #121 (step 9): centralized typed config. Inventory of every env var the
// api-server reads at runtime. New code SHOULD read from here rather than
// `process.env.*` directly so future audits stay simple. Existing call sites
// that still read `process.env.*` continue to work — this module is additive.

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} environment variable is required`);
  return v;
}

function optional(name: string): string | undefined {
  return process.env[name] || undefined;
}

export const config = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  isProduction: process.env.NODE_ENV === "production",
  port: process.env.PORT,
  logLevel: process.env.LOG_LEVEL ?? "info",

  // Auth
  jwtSecret: process.env.JWT_SECRET,
  // New (Task #121) short-lived access token TTL. Refresh tokens are 30d.
  // Legacy /auth/login still issues the existing 7d token for backward compat
  // until the web client opts in to the refresh flow.
  accessTokenTtlSeconds: 60 * 60, // 1h
  refreshTokenTtlSeconds: 60 * 60 * 24 * 30, // 30d

  // Storage / R2
  r2Endpoint: optional("R2_ENDPOINT"),
  r2Bucket: optional("R2_BUCKET"),
  r2AccessKeyId: optional("R2_ACCESS_KEY_ID"),
  r2SecretAccessKey: optional("R2_SECRET_ACCESS_KEY"),

  // Email
  resendApiKey: optional("RESEND_API_KEY"),

  // AI
  openAiBaseUrl: optional("AI_INTEGRATIONS_OPENAI_BASE_URL"),
  openAiApiKey: optional("AI_INTEGRATIONS_OPENAI_API_KEY"),

  // Public site
  publicBasePath: (process.env.PUBLIC_BASE_PATH || "/polo-manager").replace(/\/+$/, ""),
  liveDeploymentUrl: optional("LIVE_DEPLOYMENT_URL"),

  // Future native clients identify themselves with this kind. The web app is
  // grandfathered in as "web" without needing an API key.
  defaultClientKind: "web" as const,
} as const;

export type ClientKind = "web" | "ios" | "android" | "tvos" | "obs";
export const CLIENT_KINDS: ReadonlyArray<ClientKind> = ["web", "ios", "android", "tvos", "obs"];

export function requiredEnv(name: string): string {
  return required(name);
}
