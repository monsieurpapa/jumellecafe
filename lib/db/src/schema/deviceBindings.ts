import { pgTable, text, timestamp, uuid, pgEnum, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { cooperativesTable } from "./cooperatives";

export const bindingStatusEnum = pgEnum("binding_status", ["active", "revoked"]);

export const deviceBindingsTable = pgTable(
  "device_bindings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // = user_profiles.userId (= auth.users.id). No FK object, same
    // cross-schema convention as user_profiles.userId.
    userId: uuid("user_id").notNull(),
    cooperativeId: uuid("cooperative_id")
      .notNull()
      .references(() => cooperativesTable.id),
    deviceId: text("device_id").notNull(), // client-generated uuid, persisted on-device
    deviceCode: text("device_code").notNull(), // server-assigned, e.g. "D01"
    deviceLabel: text("device_label"),
    status: bindingStatusEnum("status").notNull().default("active"),
    boundAt: timestamp("bound_at").notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at"),
    revokedAt: timestamp("revoked_at"),
    revokedBy: uuid("revoked_by"),
  },
  (table) => [
    // One active device per agronome — the enforcement primitive behind
    // "single-tenant per device per agronome" (plan §5).
    uniqueIndex("device_bindings_one_active_per_user")
      .on(table.userId)
      .where(sql`${table.status} = 'active'`),
    // Device codes never collide within a cooperative — this is what makes
    // the producer_code algorithm (plan §3) collision-safe offline.
    uniqueIndex("device_bindings_unique_code_per_coop").on(table.cooperativeId, table.deviceCode),
  ],
);

export const insertDeviceBindingSchema = createInsertSchema(deviceBindingsTable).omit({
  id: true,
  boundAt: true,
});

export type DeviceBinding = typeof deviceBindingsTable.$inferSelect;
export type InsertDeviceBinding = z.infer<typeof insertDeviceBindingSchema>;
