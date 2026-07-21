import { pgTable, text, numeric, timestamp, uuid, pgEnum, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { cooperativesTable } from "./cooperatives";

export const stationTypeEnum = pgEnum("station_type", ["lavage", "collecte"]);
export const stationStatutEnum = pgEnum("station_statut", ["active", "partielle", "inactive"]);

/**
 * Stations de lavage + points de collecte (Suivi Production module).
 * Admin-created online (never offline), then synced DOWN to the field-pwa
 * so the offline livraison form can reference them — see powersync/sync-rules.yaml.
 */
export const stationsTable = pgTable(
  "stations",
  {
    id: uuid("id").primaryKey().defaultRandom(), // server-generated: stations are created online by the admin
    cooperativeId: uuid("cooperative_id")
      .notNull()
      .references(() => cooperativesTable.id),
    // Short display code shown on the map, e.g. "C-KALEHE-A". Unique per cooperative.
    code: text("code").notNull(),
    nom: text("nom").notNull(),
    type: stationTypeEnum("type").notNull().default("lavage"),
    village: text("village"),
    territoire: text("territoire"),
    latitude: numeric("latitude", { precision: 9, scale: 6, mode: "number" }),
    longitude: numeric("longitude", { precision: 9, scale: 6, mode: "number" }),
    altitudeM: numeric("altitude_m", { precision: 7, scale: 2, mode: "number" }),
    capaciteTonnesSaison: numeric("capacite_tonnes_saison", { precision: 10, scale: 2, mode: "number" }),
    responsableNom: text("responsable_nom"),
    responsableTelephone: text("responsable_telephone"),
    sourceEau: text("source_eau"),
    // Free-text comma-separated tags ("Bio, EUDR, RainForest" / "Arabica Cerises, Parche")
    certifications: text("certifications"),
    produits: text("produits"),
    statut: stationStatutEnum("statut").notNull().default("active"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [uniqueIndex("stations_unique_code_per_coop").on(table.cooperativeId, table.code)],
);

export const insertStationSchema = createInsertSchema(stationsTable).omit({
  id: true,
  createdAt: true,
});

// Partial update: code and cooperativeId are immutable after creation.
export const stationUpdateSchema = createInsertSchema(stationsTable)
  .omit({ id: true, cooperativeId: true, code: true, createdAt: true })
  .partial();

export type Station = typeof stationsTable.$inferSelect;
export type InsertStation = z.infer<typeof insertStationSchema>;
export type StationUpdate = z.infer<typeof stationUpdateSchema>;
