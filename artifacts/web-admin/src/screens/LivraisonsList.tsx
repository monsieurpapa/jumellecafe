import { useEffect, useMemo, useState } from "react";
import { fetchLivraisons, fetchStations, fetchProducteurs, type Livraison, type Station, type Producteur } from "../lib/api.js";
import { ErrorBanner, EmptyState } from "@jumelle/ui";

export default function LivraisonsList() {
  const [livraisons, setLivraisons] = useState<Livraison[] | null>(null);
  const [stations, setStations] = useState<Station[]>([]);
  const [producteurs, setProducteurs] = useState<Producteur[]>([]);
  const [stationFilter, setStationFilter] = useState("");
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    Promise.all([fetchStations(), fetchProducteurs()])
      .then(([s, p]) => {
        setStations(s);
        setProducteurs(p);
      })
      .catch(setError);
  }, []);

  useEffect(() => {
    setLivraisons(null);
    fetchLivraisons(stationFilter || undefined)
      .then(setLivraisons)
      .catch(setError);
  }, [stationFilter]);

  const stationById = useMemo(() => new Map(stations.map((s) => [s.id, s])), [stations]);
  const producteurById = useMemo(() => new Map(producteurs.map((p) => [p.id, p])), [producteurs]);
  const totalKg = useMemo(() => (livraisons ?? []).reduce((sum, l) => sum + l.poidsKg, 0), [livraisons]);

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold mb-1">Livraisons producteurs</h1>
      <p className="text-neutral-500 mb-4">
        {livraisons
          ? `${livraisons.length} bon(s) de livraison — ${totalKg.toLocaleString("fr-FR")} kg`
          : "Chargement…"}
      </p>

      <label className="text-sm block mb-4">
        Station
        <select
          className="border rounded px-2 py-1 text-sm ml-2"
          value={stationFilter}
          onChange={(e) => setStationFilter(e.target.value)}
        >
          <option value="">Toutes les stations</option>
          {stations.map((s) => (
            <option key={s.id} value={s.id}>
              {s.nom} ({s.code})
            </option>
          ))}
        </select>
      </label>

      <ErrorBanner error={error} />

      {livraisons && livraisons.length === 0 && (
        <EmptyState message="Aucune livraison pour ce filtre." />
      )}

      {livraisons && livraisons.length > 0 && (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm border-collapse">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2 pr-4">Bon N°</th>
                <th className="py-2 pr-4">Date</th>
                <th className="py-2 pr-4">Producteur</th>
                <th className="py-2 pr-4">Station</th>
                <th className="py-2 pr-4">Produit</th>
                <th className="py-2 pr-4">Poids (kg)</th>
                <th className="py-2 pr-4">Prix (CDF/kg)</th>
                <th className="py-2 pr-4">Appareil</th>
              </tr>
            </thead>
            <tbody>
              {livraisons.map((l) => {
                const producteur = producteurById.get(l.producteurId);
                const station = stationById.get(l.stationId);
                return (
                  <tr key={l.id} className="border-b">
                    <td className="py-2 pr-4 font-mono text-xs">{l.bonNumber}</td>
                    <td className="py-2 pr-4">{l.dateLivraison}</td>
                    <td className="py-2 pr-4">
                      {producteur ? `${producteur.nom} ${producteur.prenom}` : l.producteurId.slice(0, 8)}
                    </td>
                    <td className="py-2 pr-4">{station ? station.nom : l.stationId.slice(0, 8)}</td>
                    <td className="py-2 pr-4">{l.produit === "cerises" ? "Cerises" : "Parche"}</td>
                    <td className="py-2 pr-4">{l.poidsKg}</td>
                    <td className="py-2 pr-4">{l.prixUnitaireCdf ?? "—"}</td>
                    <td className="py-2 pr-4 font-mono text-xs">{l.deviceCode}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
