import { pgTable, text, boolean, timestamp, uuid, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { cooperativesTable } from "./cooperatives";

export const userRoleEnum = pgEnum("user_role", [
  "super_admin",
  "admin_cooperative",
  "agronome",
  "auditeur",
]);

export const userProfilesTable = pgTable("user_profiles", {
  // = auth.users.id (Supabase Auth). Cross-schema, so no Drizzle FK object —
  // enforced at the app layer, same as kazi's org_memberships.userId.
  userId: uuid("user_id").primaryKey(),
  // Nullable only for super_admin, who is not scoped to any single cooperative.
  cooperativeId: uuid("cooperative_id").references(() => cooperativesTable.id),
  role: userRoleEnum("role").notNull(),
  nomComplet: text("nom_complet"),
  telephone: text("telephone"),
  actif: boolean("actif").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertUserProfileSchema = createInsertSchema(userProfilesTable).omit({
  createdAt: true,
});

export type UserProfile = typeof userProfilesTable.$inferSelect;
export type InsertUserProfile = z.infer<typeof insertUserProfileSchema>;
export type Role = (typeof userRoleEnum.enumValues)[number];
