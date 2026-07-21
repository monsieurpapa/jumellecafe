import { pgTable, text, numeric, boolean, date, timestamp, uuid, pgEnum, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { cooperativesTable } from "./cooperatives";
import { stationsTable } from "./stations";

export const lotStatutEnum = pgEnum("lot_statut", ["en_traitement", "pret_export", "exporte"]);

/**
 * Lots de traçabilité (Traçabilité module, Phase 3). Constituted ONLINE by
 * the Admin Coopérative from synced livraisons of one station — never
 * created offline, so ids are server-generated. The chain of custody is:
 * parcelle GPS → producteur → livraison (lot_id) → lot → export.
 */
export const lotsTable = pgTable(
  "lots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cooperativeId: uuid("cooperative_id")
      .notNull()
      .references(() => cooperativesTable.id),
    stationId: uuid("station_id")
      .notNull()
      .references(() => stationsTable.id),
    // Human-readable lot code, e.g. LOT-ARA-MAENDELEO-4F2K9C1A (lib/shared/src/lotCode.ts)
    code: text("code").notNull(),
    culture: text("culture").notNull(), // e.g. "Arabica Lavé"
    // Frozen at constitution time (sum of member livraisons) — deliberately
    // NOT recomputed later, so an exported lot's weight is immutable history.
    poidsKg: numeric("poids_kg", { precision: 12, scale: 2, mode: "number" }).notNull(),
    // true iff every producteur in the lot had ≥1 GPS-located parcelle at
    // constitution time (the EUDR geolocation requirement).
    eudrConforme: boolean("eudr_conforme").notNull().default(false),
    statut: lotStatutEnum("statut").notNull().default("en_traitement"),
    acheteur: text("acheteur"),
    paysDestination: text("pays_destination"),
    dateExport: date("date_export"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [uniqueIndex("lots_unique_code_per_coop").on(table.cooperativeId, table.code)],
);

export const insertLotSchema = createInsertSchema(lotsTable).omit({
  id: true,
  createdAt: true,
});

export type Lot = typeof lotsTable.$inferSelect;
export type InsertLot = z.infer<typeof insertLotSchema>;
