import { column, Schema, Table } from "@powersync/web";

// Mirrors lib/db/src/schema/producteurs.ts and parcelles.ts field-for-field
// (same camelCase property names as the Drizzle schema, so opData needs no
// translation layer in the sync connector/endpoints) — update this file
// alongside the Drizzle schema on any synced-table change (plan §4; there's
// no automatic codegen bridging Postgres <-> local SQLite). No primary key
// declaration needed: PowerSync creates it automatically from the
// client-generated `id` used in every insert.
const producteurs = new Table({
  cooperativeId: column.text,
  producerCode: column.text,
  nom: column.text,
  prenom: column.text,
  sexe: column.text,
  age: column.integer,
  dateEnregistrement: column.text,
  culturePrincipale: column.text,
  nombreChamps: column.integer,
  surfaceBiologiqueHa: column.real,
  nombrePieds: column.integer,
  estimationRendementKgHa: column.real,
  statutIcs: column.text,
  groupement: column.text,
  village: column.text,
  territoire: column.text,
  province: column.text,
  agronomeId: column.text,
  deviceCode: column.text,
  createdOfflineAt: column.text,
});

const parcelles = new Table({
  producteurId: column.text,
  cooperativeId: column.text,
  latitude: column.real,
  longitude: column.real,
  altitudeM: column.real,
  superficieHa: column.real,
});

// Download-only: stations are created online by the admin (never on-device),
// synced down so the offline livraison form can list them.
const stations = new Table({
  cooperativeId: column.text,
  code: column.text,
  nom: column.text,
  type: column.text,
  village: column.text,
  territoire: column.text,
  latitude: column.real,
  longitude: column.real,
  altitudeM: column.real,
  capaciteTonnesSaison: column.real,
  responsableNom: column.text,
  responsableTelephone: column.text,
  sourceEau: column.text,
  certifications: column.text,
  produits: column.text,
  statut: column.text,
});

const livraisons = new Table({
  cooperativeId: column.text,
  producteurId: column.text,
  stationId: column.text,
  bonNumber: column.text,
  produit: column.text,
  poidsKg: column.real,
  prixUnitaireCdf: column.real,
  dateLivraison: column.text,
  agronomeId: column.text,
  deviceCode: column.text,
  createdOfflineAt: column.text,
});

const inspections = new Table({
  cooperativeId: column.text,
  producteurId: column.text,
  parcelleId: column.text,
  dateInspection: column.text,
  etatPhytosanitaire: column.integer,
  pratiquesEntretien: column.integer,
  fertilisationSol: column.integer,
  gestionEau: column.integer,
  bonnesPratiques: column.integer,
  conformiteEnvironnementale: column.integer,
  conditionsTravail: column.integer,
  scoreGlobal: column.integer,
  conforme: column.integer, // SQLite has no boolean — 0/1
  recommandations: column.text,
  agronomeId: column.text,
  deviceCode: column.text,
  createdOfflineAt: column.text,
});

export const appSchema = new Schema({ producteurs, parcelles, stations, livraisons, inspections });

export type Database = (typeof appSchema)["types"];
