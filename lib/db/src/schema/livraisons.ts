import { pgTable, text, numeric, date, timestamp, uuid, pgEnum, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { cooperativesTable } from "./cooperatives";
import { producteursTable } from "./producteurs";
import { stationsTable } from "./stations";
import { lotsTable } from "./lots";

export const produitLivraisonEnum = pgEnum("produit_livraison", ["cerises", "parche"]);

/**
 * Bons de livraison producteur → station (Suivi Production module).
 * Created offline in the field-pwa (same client-generated-id + device_code
 * collision-safety design as producteurs) and uploaded through
 * POST /api/sync/livraisons.
 */
export const livraisonsTable = pgTable(
  "livraisons",
  {
    id: uuid("id").primaryKey(), // client-generated, same convention as producteurs.id
    cooperativeId: uuid("cooperative_id")
      .notNull()
      .references(() => cooperativesTable.id),
    producteurId: uuid("producteur_id")
      .notNull()
      .references(() => producteursTable.id),
    stationId: uuid("station_id")
      .notNull()
      .references(() => stationsTable.id),
    // Human-readable receipt number: {COOP}-{DEVICE_CODE}-BL-{SEQ}
    // (lib/shared/src/bonLivraison.ts) — same offline collision-safety
    // reasoning as producer_code, unique per cooperative as the server-side net.
    bonNumber: text("bon_number").notNull(),
    produit: produitLivraisonEnum("produit").notNull(),
    poidsKg: numeric("poids_kg", { precision: 10, scale: 2, mode: "number" }).notNull(),
    prixUnitaireCdf: numeric("prix_unitaire_cdf", { precision: 12, scale: 2, mode: "number" }),
    dateLivraison: date("date_livraison").notNull(),
    // Set server-side when the Admin constitutes a lot (Phase 3) — never
    // written by the field-pwa; the sync PATCH path can't touch it because
    // livraisonSyncSchema has no lotId field.
    lotId: uuid("lot_id").references(() => lotsTable.id),
    agronomeId: uuid("agronome_id").notNull(),
    deviceCode: text("device_code").notNull(),
    // Client clock (may drift) — never authoritative ordering, same caveat as producteurs.
    createdOfflineAt: timestamp("created_offline_at").notNull(),
    syncedAt: timestamp("synced_at").notNull().defaultNow(),
  },
  (table) => [uniqueIndex("livraisons_unique_bon_per_coop").on(table.cooperativeId, table.bonNumber)],
);

export const insertLivraisonSchema = createInsertSchema(livraisonsTable).omit({
  syncedAt: true,
});

export type Livraison = typeof livraisonsTable.$inferSelect;
export type InsertLivraison = z.infer<typeof insertLivraisonSchema>;
