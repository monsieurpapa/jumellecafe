import { supabase } from "./supabase.js";

const API_URL = import.meta.env["VITE_API_URL"] as string;

export class ApiError extends Error {
  constructor(
    public status: number,
    public body: unknown,
  ) {
    super(`API error ${status}`);
  }
}

// Set by App.tsx once a Super Admin picks a cooperative from the scope
// picker (Super Admin has no home cooperative, see plan §5). Harmless to
// leave set for other roles — the server always prefers the caller's own
// req.profile.cooperativeId over this query param when both are present.
let activeCooperativeId: string | null = null;

export function setActiveCooperativeId(id: string | null) {
  activeCooperativeId = id;
}

function withCoopScope(path: string): string {
  if (!activeCooperativeId) return path;
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}cooperativeId=${encodeURIComponent(activeCooperativeId)}`;
}

async function authedFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Not authenticated");

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { ...options.headers, Authorization: `Bearer ${token}` },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, body);
  return body as T;
}

export interface MeResponse {
  user: { id: string; email: string };
  profile: { userId: string; cooperativeId: string | null; role: string };
  cooperative: { id: string; code: string; nom: string } | null;
}

export function fetchMe(): Promise<MeResponse> {
  return authedFetch("/api/me");
}

export interface Cooperative {
  id: string;
  code: string;
  nom: string;
  province: string;
  territoire: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  eudrBaselineUploaded: boolean;
  actif: boolean;
  createdAt: string;
}

export function fetchCooperatives(): Promise<Cooperative[]> {
  return authedFetch("/api/cooperatives");
}

export interface CreateCooperativeInput {
  code: string;
  nom: string;
  province?: string;
  territoire?: string;
  contactEmail?: string;
  contactPhone?: string;
  eudrBaselineUploaded?: boolean;
  adminEmail: string;
  adminNomComplet?: string;
}

export function createCooperative(
  input: CreateCooperativeInput,
): Promise<{ cooperative: Cooperative; adminProfile: { userId: string; role: string } }> {
  return authedFetch("/api/cooperatives", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export interface UpdateCooperativeInput {
  nom?: string;
  province?: string;
  territoire?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  eudrBaselineUploaded?: boolean;
  actif?: boolean;
}

export function updateCooperative(cooperativeId: string, input: UpdateCooperativeInput): Promise<Cooperative> {
  return authedFetch(`/api/cooperatives/${encodeURIComponent(cooperativeId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export interface Producteur {
  id: string;
  producerCode: string;
  nom: string;
  prenom: string;
  sexe: "M" | "F";
  age: number | null;
  dateEnregistrement: string;
  culturePrincipale: "cafe" | "cacao";
  nombreChamps: number | null;
  surfaceBiologiqueHa: number;
  nombrePieds: number | null;
  estimationRendementKgHa: number | null;
  statutIcs: string;
  groupement: string | null;
  village: string;
  territoire: string;
  province: string;
  deviceCode: string;
  syncedAt: string;
}

export function fetchProducteurs(): Promise<Producteur[]> {
  return authedFetch(withCoopScope("/api/producteurs"));
}

export interface Station {
  id: string;
  code: string;
  nom: string;
  type: "lavage" | "collecte";
  village: string | null;
  territoire: string | null;
  latitude: number | null;
  longitude: number | null;
  altitudeM: number | null;
  capaciteTonnesSaison: number | null;
  responsableNom: string | null;
  responsableTelephone: string | null;
  sourceEau: string | null;
  certifications: string | null;
  produits: string | null;
  statut: "active" | "partielle" | "inactive";
}

export function fetchStations(): Promise<Station[]> {
  return authedFetch(withCoopScope("/api/stations"));
}

export interface CreateStationInput {
  code: string;
  nom: string;
  type: "lavage" | "collecte";
  village?: string;
  territoire?: string;
  latitude?: number;
  longitude?: number;
  altitudeM?: number;
  capaciteTonnesSaison?: number;
  responsableNom?: string;
  responsableTelephone?: string;
  sourceEau?: string;
  certifications?: string;
  produits?: string;
  statut?: "active" | "partielle" | "inactive";
}

export function createStation(input: CreateStationInput): Promise<Station> {
  return authedFetch("/api/stations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export function updateStation(stationId: string, input: Partial<CreateStationInput>): Promise<Station> {
  return authedFetch(`/api/stations/${encodeURIComponent(stationId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export interface Livraison {
  id: string;
  producteurId: string;
  stationId: string;
  bonNumber: string;
  produit: "cerises" | "parche";
  poidsKg: number;
  prixUnitaireCdf: number | null;
  dateLivraison: string;
  lotId: string | null;
  deviceCode: string;
  syncedAt: string;
}

export function fetchLivraisons(stationId?: string): Promise<Livraison[]> {
  const qs = stationId ? `?stationId=${encodeURIComponent(stationId)}` : "";
  return authedFetch(withCoopScope(`/api/livraisons${qs}`));
}

export interface Inspection {
  id: string;
  producteurId: string;
  parcelleId: string | null;
  dateInspection: string;
  etatPhytosanitaire: number;
  pratiquesEntretien: number;
  fertilisationSol: number;
  gestionEau: number;
  bonnesPratiques: number;
  conformiteEnvironnementale: number;
  conditionsTravail: number;
  scoreGlobal: number;
  conforme: boolean;
  recommandations: string;
  deviceCode: string;
  syncedAt: string;
}

export function fetchInspections(producteurId?: string): Promise<Inspection[]> {
  const qs = producteurId ? `?producteurId=${encodeURIComponent(producteurId)}` : "";
  return authedFetch(withCoopScope(`/api/inspections${qs}`));
}

export type TransactionProduit = "cerises" | "parche" | "cafe_vert" | "cacao_fermente" | "cacao_standard" | "autre";

export interface Transaction {
  id: string;
  reference: string;
  type: "achat" | "vente";
  produit: TransactionProduit;
  contrepartie: string;
  quantiteKg: number;
  prixUnitaireCdf: number;
  montantCdf: number;
  dateTransaction: string;
  createdAt: string;
}

export function fetchTransactions(): Promise<Transaction[]> {
  return authedFetch(withCoopScope("/api/transactions"));
}

export interface CreateTransactionInput {
  type: "achat" | "vente";
  produit: TransactionProduit;
  contrepartie: string;
  quantiteKg: number;
  prixUnitaireCdf: number;
  dateTransaction: string;
}

export function createTransaction(input: CreateTransactionInput): Promise<Transaction> {
  return authedFetch("/api/transactions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export function updateTransaction(
  transactionId: string,
  input: Partial<CreateTransactionInput>,
): Promise<Transaction> {
  return authedFetch(`/api/transactions/${encodeURIComponent(transactionId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export function deleteTransaction(transactionId: string): Promise<void> {
  return authedFetch(`/api/transactions/${encodeURIComponent(transactionId)}`, { method: "DELETE" });
}

export interface Lot {
  id: string;
  stationId: string;
  code: string;
  culture: string;
  poidsKg: number;
  eudrConforme: boolean;
  statut: "en_traitement" | "pret_export" | "exporte";
  acheteur: string | null;
  paysDestination: string | null;
  dateExport: string | null;
  createdAt: string;
  livraisonsCount: number;
  producteursCount: number;
}

export function fetchLots(): Promise<Lot[]> {
  return authedFetch(withCoopScope("/api/lots"));
}

export interface Parcelle {
  id: string;
  producteurId: string;
  latitude: number;
  longitude: number;
  altitudeM: number | null;
  superficieHa: number | null;
}

export interface ParcelleWithProducteur {
  parcelle: Parcelle;
  producteur: Producteur;
}

export function fetchParcelles(): Promise<ParcelleWithProducteur[]> {
  return authedFetch(withCoopScope("/api/parcelles"));
}

export interface LotDetail {
  lot: Omit<Lot, "livraisonsCount" | "producteursCount">;
  livraisons: { livraison: Livraison; producteur: Producteur }[];
  parcelles: Parcelle[];
}

export function fetchLotDetail(lotId: string): Promise<LotDetail> {
  return authedFetch(withCoopScope(`/api/lots/${encodeURIComponent(lotId)}`));
}

export interface CreateLotInput {
  stationId: string;
  culture: string;
  livraisonIds: string[];
  acheteur?: string;
  paysDestination?: string;
}

export function createLot(input: CreateLotInput): Promise<Lot> {
  return authedFetch("/api/lots", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export function updateLot(
  lotId: string,
  input: Partial<Pick<Lot, "statut" | "acheteur" | "paysDestination" | "dateExport">>,
): Promise<Lot> {
  return authedFetch(`/api/lots/${encodeURIComponent(lotId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export interface DeviceBinding {
  id: string;
  userId: string;
  agronomeNom: string | null;
  deviceCode: string;
  deviceLabel: string | null;
  status: "active" | "revoked";
  boundAt: string;
  lastSeenAt: string | null;
  revokedAt: string | null;
}

export function fetchDeviceBindings(): Promise<DeviceBinding[]> {
  return authedFetch(withCoopScope("/api/device-bindings"));
}

export function revokeDeviceBinding(bindingId: string): Promise<DeviceBinding> {
  return authedFetch(`/api/device-bindings/${encodeURIComponent(bindingId)}/revoke`, { method: "PATCH" });
}
