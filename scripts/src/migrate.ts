import { runMigrations } from "@workspace/db";

try {
  await runMigrations();
  console.log("Database migrations applied successfully");
  process.exit(0);
} catch (err) {
  console.error("Migration failed:", err);
  process.exit(1);
}
