import { pgTable, uuid, jsonb, timestamp, boolean } from "drizzle-orm/pg-core";
import { fieldsTable } from "./fields";

export const fieldWeatherCacheTable = pgTable("field_weather_cache", {
  fieldId: uuid("field_id")
    .primaryKey()
    .references(() => fieldsTable.id, { onDelete: "cascade" }),
  payload: jsonb("payload").notNull(),
  isError: boolean("is_error").default(false).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  lastSuccessPayload: jsonb("last_success_payload"),
});

export type FieldWeatherCache = typeof fieldWeatherCacheTable.$inferSelect;
