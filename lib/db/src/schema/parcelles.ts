import { pgTable, numeric, timestamp, uuid, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { producteursTable } from "./producteurs";
import { cooperativesTable } from "./cooperatives";

export const parcellesTable = pgTable("parcelles", {
  id: uuid("id").primaryKey(), // client-generated, same convention as producteurs.id
  producteurId: uuid("producteur_id")
    .notNull()
    .references(() => producteursTable.id),
  cooperativeId: uuid("cooperative_id")
    .notNull()
    .references(() => cooperativesTable.id),
  latitude: numeric("latitude", { precision: 9, scale: 6, mode: "number" }).notNull(),
  longitude: numeric("longitude", { precision: 9, scale: 6, mode: "number" }).notNull(),
  altitudeM: numeric("altitude_m", { precision: 7, scale: 2, mode: "number" }),
  superficieHa: numeric("superficie_ha", { precision: 10, scale: 4, mode: "number" }),
  polygonGeojson: jsonb("polygon_geojson"), // reserved, unused Phase 1
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertParcelleSchema = createInsertSchema(parcellesTable).omit({
  createdAt: true,
});

export type Parcelle = typeof parcellesTable.$inferSelect;
export type InsertParcelle = z.infer<typeof insertParcelleSchema>;
