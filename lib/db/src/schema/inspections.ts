import { pgTable, text, integer, boolean, date, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { cooperativesTable } from "./cooperatives";
import { producteursTable } from "./producteurs";
import { parcellesTable } from "./parcelles";

/**
 * Inspections de terrain (Audit Interne, Phase 4). Created offline in the
 * field-pwa (client-generated id, same design as producteurs) and uploaded
 * through POST /api/sync/inspections. The 7 criteria are each 0-5
 * (lib/shared/src/inspectionScore.ts); score_global and conforme are
 * recomputed server-side from the raw criteria on every upload.
 */
export const inspectionsTable = pgTable("inspections", {
  id: uuid("id").primaryKey(), // client-generated
  cooperativeId: uuid("cooperative_id")
    .notNull()
    .references(() => cooperativesTable.id),
  producteurId: uuid("producteur_id")
    .notNull()
    .references(() => producteursTable.id),
  parcelleId: uuid("parcelle_id").references(() => parcellesTable.id),
  dateInspection: date("date_inspection").notNull(),
  etatPhytosanitaire: integer("etat_phytosanitaire").notNull(),
  pratiquesEntretien: integer("pratiques_entretien").notNull(),
  fertilisationSol: integer("fertilisation_sol").notNull(),
  gestionEau: integer("gestion_eau").notNull(),
  bonnesPratiques: integer("bonnes_pratiques").notNull(),
  conformiteEnvironnementale: integer("conformite_environnementale").notNull(),
  conditionsTravail: integer("conditions_travail").notNull(),
  // Derived, /100 — kept denormalized for cheap dashboard queries, but the
  // raw criteria remain the source of truth.
  scoreGlobal: integer("score_global").notNull(),
  conforme: boolean("conforme").notNull(),
  recommandations: text("recommandations").notNull(),
  agronomeId: uuid("agronome_id").notNull(),
  deviceCode: text("device_code").notNull(),
  createdOfflineAt: timestamp("created_offline_at").notNull(),
  syncedAt: timestamp("synced_at").notNull().defaultNow(),
});

export const insertInspectionSchema = createInsertSchema(inspectionsTable).omit({
  syncedAt: true,
});

export type Inspection = typeof inspectionsTable.$inferSelect;
export type InsertInspection = z.infer<typeof insertInspectionSchema>;
