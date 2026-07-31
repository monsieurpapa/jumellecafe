import { z } from "zod/v4";

/**
 * Field-for-field match with the local PowerSync row (field-pwa's
 * powersync/schema.ts) and the Postgres row (lib/db's producteurs.ts) —
 * used both for client-side validation before the local write and
 * server-side re-validation on upload (plan §4). cooperativeId/agronomeId/
 * deviceCode are required here for local consistency, but the server
 * always re-derives them from the authenticated session + active device
 * binding rather than trusting the client-sent values (plan §5).
 */
export const producteurSyncSchema = z.object({
  id: z.string().uuid(),
  cooperativeId: z.string().uuid(),
  producerCode: z.string().min(1),
  nom: z.string().min(1),
  prenom: z.string().min(1),
  sexe: z.enum(["M", "F"]),
  age: z.number().int().positive().nullable().optional(),
  dateEnregistrement: z.string().min(1),
  culturePrincipale: z.enum(["cafe", "cacao"]),
  nombreChamps: z.number().int().nonnegative().nullable().optional(),
  surfaceBiologiqueHa: z.number().positive(),
  nombrePieds: z.number().int().nonnegative().nullable().optional(),
  estimationRendementKgHa: z.number().nonnegative().nullable().optional(),
  statutIcs: z.enum(["biologique", "conventionnel", "transition"]),
  groupement: z.string().nullable().optional(),
  village: z.string().min(1),
  territoire: z.string().min(1),
  province: z.string().min(1),
  agronomeId: z.string().uuid(),
  deviceCode: z.string().min(1),
  createdOfflineAt: z.string().min(1),
});

export const parcelleSyncSchema = z.object({
  id: z.string().uuid(),
  producteurId: z.string().uuid(),
  cooperativeId: z.string().uuid(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  altitudeM: z.number().nullable().optional(),
  superficieHa: z.number().positive().nullable().optional(),
});

/**
 * Same dual-use contract as producteurSyncSchema: validated client-side
 * before the local PowerSync write, re-validated server-side on upload.
 * cooperativeId/agronomeId/deviceCode are re-derived server-side from the
 * session + active device binding, never trusted from the client (plan §5).
 */
export const livraisonSyncSchema = z.object({
  id: z.string().uuid(),
  cooperativeId: z.string().uuid(),
  producteurId: z.string().uuid(),
  stationId: z.string().uuid(),
  bonNumber: z.string().min(1),
  produit: z.enum(["cerises", "parche"]),
  poidsKg: z.number().positive(),
  prixUnitaireCdf: z.number().nonnegative().nullable().optional(),
  dateLivraison: z.string().min(1),
  agronomeId: z.string().uuid(),
  deviceCode: z.string().min(1),
  createdOfflineAt: z.string().min(1),
});

const scoreCritere = z.number().int().min(0).max(5);

/**
 * Audit Interne inspection (Phase 4) — same dual-use contract as
 * producteurSyncSchema. scoreGlobal/conforme are NOT part of the payload:
 * both are recomputed from the raw criteria wherever they're needed
 * (lib/shared/src/inspectionScore.ts), so a tampered client can't
 * self-certify conformity.
 */
export const inspectionSyncSchema = z.object({
  id: z.string().uuid(),
  cooperativeId: z.string().uuid(),
  producteurId: z.string().uuid(),
  parcelleId: z.string().uuid().nullable().optional(),
  dateInspection: z.string().min(1),
  etatPhytosanitaire: scoreCritere,
  pratiquesEntretien: scoreCritere,
  fertilisationSol: scoreCritere,
  gestionEau: scoreCritere,
  bonnesPratiques: scoreCritere,
  conformiteEnvironnementale: scoreCritere,
  conditionsTravail: scoreCritere,
  recommandations: z.string().min(1),
  agronomeId: z.string().uuid(),
  deviceCode: z.string().min(1),
  createdOfflineAt: z.string().min(1),
});

/**
 * Body of POST /api/lots (Phase 3, online-only): the Admin picks a station
 * and a set of that station's un-lotted livraisons. cooperativeId, poids,
 * code and EUDR conformity are all derived server-side.
 */
export const lotCreateSchema = z.object({
  stationId: z.string().uuid(),
  culture: z.string().min(1),
  livraisonIds: z.array(z.string().uuid()).min(1),
  acheteur: z.string().min(1).nullable().optional(),
  paysDestination: z.string().min(1).nullable().optional(),
});

/**
 * Body of POST /api/transactions (Phase 5, online-only). montant is
 * computed server-side (quantite × prix); reference is server-generated.
 */
export const transactionCreateSchema = z.object({
  type: z.enum(["achat", "vente"]),
  produit: z.enum(["cerises", "parche", "cafe_vert", "cacao_fermente", "cacao_standard", "autre"]),
  contrepartie: z.string().min(1),
  quantiteKg: z.number().positive(),
  prixUnitaireCdf: z.number().positive(),
  dateTransaction: z.string().min(1),
});

/** Body of PATCH /api/transactions/:id — same field rules as create, all optional. */
export const transactionUpdateSchema = z.object({
  type: z.enum(["achat", "vente"]).optional(),
  produit: z.enum(["cerises", "parche", "cafe_vert", "cacao_fermente", "cacao_standard", "autre"]).optional(),
  contrepartie: z.string().min(1).optional(),
  quantiteKg: z.number().positive().optional(),
  prixUnitaireCdf: z.number().positive().optional(),
  dateTransaction: z.string().min(1).optional(),
});

/** Body of PATCH /api/lots/:id — export bookkeeping only, never weight/composition. */
export const lotUpdateSchema = z.object({
  statut: z.enum(["en_traitement", "pret_export", "exporte"]).optional(),
  acheteur: z.string().min(1).nullable().optional(),
  paysDestination: z.string().min(1).nullable().optional(),
  dateExport: z.string().min(1).nullable().optional(),
});

export type ProducteurSyncValues = z.infer<typeof producteurSyncSchema>;
export type ParcelleSyncValues = z.infer<typeof parcelleSyncSchema>;
export type LivraisonSyncValues = z.infer<typeof livraisonSyncSchema>;
export type InspectionSyncValues = z.infer<typeof inspectionSyncSchema>;
export type LotCreateValues = z.infer<typeof lotCreateSchema>;
export type LotUpdateValues = z.infer<typeof lotUpdateSchema>;
export type TransactionCreateValues = z.infer<typeof transactionCreateSchema>;
export type TransactionUpdateValues = z.infer<typeof transactionUpdateSchema>;
