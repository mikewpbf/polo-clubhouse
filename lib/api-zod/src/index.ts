export * from "./generated/api";
// Note: ./generated/types is intentionally NOT re-exported. orval's split mode
// generates a TS interface in types/<name>.ts for every request/response that
// already exists as a zod schema (value) in api.ts. Re-exporting both surfaces
// triggers TS2308 "already exported a member" for the ~8 names that overlap.
// Current consumers only use the zod schemas (SignupBody, LoginBody,
// HealthCheckResponse). If you need the plain TS interface for a payload,
// derive it with `z.infer<typeof Schema>` from the zod export, or import the
// type directly from "@workspace/api-zod/generated/types/<name>".
