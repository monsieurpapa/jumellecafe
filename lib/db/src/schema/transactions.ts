import { pgTable, text, numeric, date, timestamp, uuid, pgEnum, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { cooperativesTable } from "./cooperatives";

export const transactionTypeEnum = pgEnum("transaction_type", ["achat", "vente"]);
export const transactionProduitEnum = pgEnum("transaction_produit", [
  "cerises",
  "parche",
  "cafe_vert",
  "cacao_fermente",
  "cacao_standard",
  "autre",
]);

/**
 * Transactions café/cacao (Finance / Collecte & Prix module, Phase 5).
 * Created ONLINE by the Admin Coopérative from the dashboard — no offline
 * path, so ids are server-generated. montant_cdf is always computed
 * server-side as quantite × prix, never taken from the client.
 */
export const transactionsTable = pgTable(
  "transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cooperativeId: uuid("cooperative_id")
      .notNull()
      .references(() => cooperativesTable.id),
    // Human-readable receipt ref, e.g. TRX-4F2K9C1A — server-generated.
    reference: text("reference").notNull(),
    type: transactionTypeEnum("type").notNull(),
    produit: transactionProduitEnum("produit").notNull(),
    contrepartie: text("contrepartie").notNull(), // producteur membre, exportateur, ...
    quantiteKg: numeric("quantite_kg", { precision: 12, scale: 2, mode: "number" }).notNull(),
    prixUnitaireCdf: numeric("prix_unitaire_cdf", { precision: 12, scale: 2, mode: "number" }).notNull(),
    montantCdf: numeric("montant_cdf", { precision: 16, scale: 2, mode: "number" }).notNull(),
    dateTransaction: date("date_transaction").notNull(),
    createdBy: uuid("created_by").notNull(), // user_profiles.user_id of the admin
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [uniqueIndex("transactions_unique_ref_per_coop").on(table.cooperativeId, table.reference)],
);

export const insertTransactionSchema = createInsertSchema(transactionsTable).omit({
  id: true,
  createdAt: true,
});

export type Transaction = typeof transactionsTable.$inferSelect;
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
