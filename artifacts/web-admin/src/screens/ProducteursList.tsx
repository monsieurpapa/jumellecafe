import { useEffect, useMemo, useState } from "react";
import { fetchProducteurs, type Producteur } from "../lib/api.js";
import { DetailPanel, ErrorBanner, EmptyState, SearchInput } from "@jumelle/ui";

export default function ProducteursList() {
  const [producteurs, setProducteurs] = useState<Producteur[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [search, setSearch] = useState("");
  const [detail, setDetail] = useState<Producteur | null>(null);

  useEffect(() => {
    fetchProducteurs()
      .then(setProducteurs)
      .catch(setError);
  }, []);

  const filtered = useMemo(() => {
    if (!producteurs) return producteurs;
    const q = search.trim().toLowerCase();
    if (!q) return producteurs;
    return producteurs.filter((p) =>
      [p.producerCode, p.nom, p.prenom, p.village, p.territoire].some((field) =>
        field.toLowerCase().includes(q),
      ),
    );
  }, [producteurs, search]);

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold mb-1">Producteurs</h1>
      <p className="text-neutral-500 mb-4">
        {producteurs
          ? `${filtered!.length} / ${producteurs.length} producteur(s) synchronisé(s)`
          : "Chargement…"}
      </p>
      <ErrorBanner error={error} />

      {producteurs && producteurs.length > 0 && (
        <div className="mb-4">
          <SearchInput value={search} onChange={setSearch} placeholder="Nom, code, village…" />
        </div>
      )}

      {producteurs && producteurs.length === 0 && (
        <EmptyState message="Aucun producteur synchronisé pour le moment." />
      )}
      {filtered && filtered.length === 0 && producteurs && producteurs.length > 0 && (
        <EmptyState message="Aucun producteur ne correspond à la recherche." />
      )}
      {filtered && filtered.length > 0 && (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm border-collapse">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2 pr-4">Code producteur</th>
                <th className="py-2 pr-4">Nom</th>
                <th className="py-2 pr-4">Prénom</th>
                <th className="py-2 pr-4">Sexe</th>
                <th className="py-2 pr-4">Culture</th>
                <th className="py-2 pr-4">Surface (ha)</th>
                <th className="py-2 pr-4">Statut ICS</th>
                <th className="py-2 pr-4">Village</th>
                <th className="py-2 pr-4">Territoire</th>
                <th className="py-2 pr-4">Détails</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} className="border-b">
                  <td className="py-2 pr-4 font-mono text-xs">{p.producerCode}</td>
                  <td className="py-2 pr-4">{p.nom}</td>
                  <td className="py-2 pr-4">{p.prenom}</td>
                  <td className="py-2 pr-4">{p.sexe}</td>
                  <td className="py-2 pr-4">{p.culturePrincipale}</td>
                  <td className="py-2 pr-4">{p.surfaceBiologiqueHa}</td>
                  <td className="py-2 pr-4">{p.statutIcs}</td>
                  <td className="py-2 pr-4">{p.village}</td>
                  <td className="py-2 pr-4">{p.territoire}</td>
                  <td className="py-2 pr-4">
                    <button className="text-emerald-700 underline" onClick={() => setDetail(p)}>
                      Voir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {detail && (
        <DetailPanel
          title={
            <>
              {detail.nom} {detail.prenom} — <span className="font-mono text-sm">{detail.producerCode}</span>
            </>
          }
          onClose={() => setDetail(null)}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1 max-w-2xl text-sm">
            <span>Âge : {detail.age ?? "—"}</span>
            <span>Date d'enregistrement : {detail.dateEnregistrement}</span>
            <span>Nombre de champs : {detail.nombreChamps ?? "—"}</span>
            <span>Nombre de pieds : {detail.nombrePieds ?? "—"}</span>
            <span>
              Estimation rendement :{" "}
              {detail.estimationRendementKgHa != null ? `${detail.estimationRendementKgHa} kg/ha` : "—"}
            </span>
            <span>Groupement : {detail.groupement ?? "—"}</span>
            <span>Province : {detail.province}</span>
            <span>Appareil : {detail.deviceCode}</span>
          </div>
        </DetailPanel>
      )}
    </div>
  );
}
