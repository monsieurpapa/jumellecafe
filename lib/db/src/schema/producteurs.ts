import { pgTable, text, integer, numeric, date, timestamp, uuid, pgEnum, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { cooperativesTable } from "./cooperatives";

export const sexeEnum = pgEnum("sexe", ["M", "F"]);
export const cultureEnum = pgEnum("culture", ["cafe", "cacao"]);
export const statutIcsEnum = pgEnum("statut_ics", ["biologique", "conventionnel", "transition"]);

export const producteursTable = pgTable(
  "producteurs",
  {
    // Client-generated (uuid v4) — the real sync/PK identity PowerSync
    // replicates on; no server round-trip needed before the local write.
    id: uuid("id").primaryKey(),
    cooperativeId: uuid("cooperative_id")
      .notNull()
      .references(() => cooperativesTable.id),
    // Human-readable business ID: {COOP}-{DEVICE_CODE}-{SEQ}-{INITIALS}-{GROUPEMENT}-{VILLAGE}
    // (lib/shared/src/producerCode.ts). Unique per cooperative as a
    // server-side safety net behind the offline collision-safety design.
    producerCode: text("producer_code").notNull(),
    nom: text("nom").notNull(),
    prenom: text("prenom").notNull(),
    sexe: sexeEnum("sexe").notNull(),
    age: integer("age"),
    dateEnregistrement: date("date_enregistrement").notNull(),
    culturePrincipale: cultureEnum("culture_principale").notNull(),
    nombreChamps: integer("nombre_champs"),
    surfaceBiologiqueHa: numeric("surface_biologique_ha", { precision: 10, scale: 4, mode: "number" }).notNull(),
    nombrePieds: integer("nombre_pieds"),
    estimationRendementKgHa: numeric("estimation_rendement_kg_ha", { precision: 10, scale: 2, mode: "number" }),
    statutIcs: statutIcsEnum("statut_ics").notNull(),
    groupement: text("groupement"),
    village: text("village").notNull(),
    territoire: text("territoire").notNull(),
    province: text("province").notNull().default("Sud-Kivu"),
    agronomeId: uuid("agronome_id").notNull(),
    deviceCode: text("device_code").notNull(),
    // Client clock (may drift) vs. server clock — never use createdOfflineAt
    // for authoritative ordering (plan risks section).
    createdOfflineAt: timestamp("created_offline_at").notNull(),
    syncedAt: timestamp("synced_at").notNull().defaultNow(),
  },
  (table) => [uniqueIndex("producteurs_unique_code_per_coop").on(table.cooperativeId, table.producerCode)],
);

export const insertProducteurSchema = createInsertSchema(producteursTable).omit({
  syncedAt: true,
});

export type Producteur = typeof producteursTable.$inferSelect;
export type InsertProducteur = z.infer<typeof insertProducteurSchema>;
