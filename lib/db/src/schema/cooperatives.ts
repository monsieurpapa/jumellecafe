import { pgTable, text, boolean, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const cooperativesTable = pgTable("cooperatives", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(), // immutable, Super-Admin-assigned at onboarding
  nom: text("nom").notNull(),
  province: text("province").notNull().default("Sud-Kivu"),
  territoire: text("territoire"),
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
  eudrBaselineUploaded: boolean("eudr_baseline_uploaded").notNull().default(false),
  actif: boolean("actif").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertCooperativeSchema = createInsertSchema(cooperativesTable).omit({
  id: true,
  createdAt: true,
});

// Partial update: code is immutable after creation, same rule as stations.
export const cooperativeUpdateSchema = createInsertSchema(cooperativesTable)
  .omit({ id: true, code: true, createdAt: true })
  .partial();

export type Cooperative = typeof cooperativesTable.$inferSelect;
export type InsertCooperative = z.infer<typeof insertCooperativeSchema>;
export type CooperativeUpdate = z.infer<typeof cooperativeUpdateSchema>;
