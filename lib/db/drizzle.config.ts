import { defineConfig } from "drizzle-kit";
import path from "path";

// IMPORTANT: All schema changes must go through the migration workflow:
//   1. pnpm --filter @workspace/db generate  — create a new migration file
//   2. pnpm --filter @workspace/db migrate   — apply it to the database
//
// Never use `drizzle-kit push` directly. Push bypasses the migration history
// table, which causes future migrations to fail or produce incorrect results.
// The `push` and `push-force` scripts have been removed for this reason.

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

export default defineConfig({
  schema: path.join(__dirname, "./src/schema/index.ts"),
  out: path.join(__dirname, "./migrations"),
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
