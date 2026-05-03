import { pgTable, uuid, varchar, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

// Task #121: extended with platform/device metadata so future iOS/Android/tvOS
// clients can register and so the eventual push pipeline knows where to send.
// `fcm_token` is kept for backward compatibility; new code reads `token`.
export const pushSubscriptionsTable = pgTable(
  "push_subscriptions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").references(() => usersTable.id).notNull(),
    fcmToken: varchar("fcm_token", { length: 500 }),
    token: varchar("token", { length: 500 }),
    platform: varchar("platform", { length: 16 }),
    deviceId: varchar("device_id", { length: 255 }),
    appVersion: varchar("app_version", { length: 64 }),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    uniqueIndex("push_subscriptions_user_token_uniq")
      .on(table.userId, table.token)
      .where(sql`${table.token} IS NOT NULL`),
  ],
);

export const insertPushSubscriptionSchema = createInsertSchema(pushSubscriptionsTable).omit({ id: true, createdAt: true });
export type InsertPushSubscription = z.infer<typeof insertPushSubscriptionSchema>;
export type PushSubscription = typeof pushSubscriptionsTable.$inferSelect;
