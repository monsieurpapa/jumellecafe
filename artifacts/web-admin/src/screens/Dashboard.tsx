import { useEffect, useMemo, useState } from "react";
import {
  fetchProducteurs,
  fetchStations,
  fetchLivraisons,
  fetchLots,
  fetchInspections,
  fetchTransactions,
  type Producteur,
  type Station,
  type Livraison,
  type Lot,
  type Inspection,
  type Transaction,
} from "../lib/api.js";
import { ErrorBanner } from "@jumelle/ui";

interface DashboardData {
  producteurs: Producteur[];
  stations: Station[];
  livraisons: Livraison[];
  lots: Lot[];
  inspections: Inspection[];
  transactions: Transaction[];
}

function StatTile({ label, value, accent }: { label: string; value: string; accent?: "emerald" | "amber" | "red" }) {
  const valueClass =
    accent === "emerald"
      ? "text-emerald-700"
      : accent === "amber"
        ? "text-amber-600"
        : accent === "red"
          ? "text-red-600"
          : "";
  return (
    <div className="border rounded p-3">
      <p className="text-xs text-neutral-500">{label}</p>
      <p className={`font-semibold text-lg ${valueClass}`}>{value}</p>
    </div>
  );
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    Promise.all([fetchProducteurs(), fetchStations(), fetchLivraisons(), fetchLots(), fetchInspections(), fetchTransactions()])
      .then(([producteurs, stations, livraisons, lots, inspections, transactions]) =>
        setData({ producteurs, stations, livraisons, lots, inspections, transactions }),
      )
      .catch(setError);
  }, []);

  const stats = useMemo(() => {
    if (!data) return null;
    const { producteurs, stations, livraisons, lots, inspections, transactions } = data;

    const totalSurfaceHa = producteurs.reduce((sum, p) => sum + p.surfaceBiologiqueHa, 0);
    const totalKg = livraisons.reduce((sum, l) => sum + l.poidsKg, 0);
    const enTraitement = lots.filter((l) => l.statut === "en_traitement").length;
    const pretExport = lots.filter((l) => l.statut === "pret_export").length;
    const exporte = lots.filter((l) => l.statut === "exporte").length;
    const eudrConformePct = lots.length > 0 ? Math.round((lots.filter((l) => l.eudrConforme).length / lots.length) * 100) : null;
    const nonConformeInspections = inspections.filter((i) => !i.conforme).length;
    const activeStations = stations.filter((s) => s.statut === "active").length;
    const achatsCdf = transactions.filter((t) => t.type === "achat").reduce((sum, t) => sum + t.montantCdf, 0);

    return {
      totalProducteurs: producteurs.length,
      totalSurfaceHa,
      totalKg,
      enTraitement,
      pretExport,
      exporte,
      eudrConformePct,
      nonConformeInspections,
      activeStations,
      totalStations: stations.length,
      achatsCdf,
    };
  }, [data]);

  const fmt = (n: number) => n.toLocaleString("fr-FR");

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold mb-1">Tableau de bord</h1>
      <p className="text-neutral-500 mb-4">{stats ? "Vue d'ensemble de la coopérative" : "Chargement…"}</p>
      <ErrorBanner error={error} />

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-4xl">
          <StatTile label="Producteurs" value={fmt(stats.totalProducteurs)} />
          <StatTile label="Surface totale (ha)" value={fmt(Math.round(stats.totalSurfaceHa * 100) / 100)} />
          <StatTile label="Collecte totale (kg)" value={fmt(stats.totalKg)} />
          <StatTile label="Stations actives" value={`${stats.activeStations} / ${stats.totalStations}`} />
          <StatTile label="Lots en traitement" value={fmt(stats.enTraitement)} accent="amber" />
          <StatTile label="Lots prêts export" value={fmt(stats.pretExport)} accent="amber" />
          <StatTile label="Lots exportés" value={fmt(stats.exporte)} accent="emerald" />
          <StatTile
            label="Conformité EUDR"
            value={stats.eudrConformePct != null ? `${stats.eudrConformePct}%` : "—"}
            accent={stats.eudrConformePct != null && stats.eudrConformePct < 100 ? "amber" : "emerald"}
          />
          <StatTile
            label="Inspections non conformes"
            value={fmt(stats.nonConformeInspections)}
            accent={stats.nonConformeInspections > 0 ? "red" : "emerald"}
          />
          <StatTile label="Achats (CDF)" value={fmt(stats.achatsCdf)} />
        </div>
      )}
    </div>
  );
}
