import { useEffect, useMemo, useState } from "react";
import { fetchInspections, fetchProducteurs, type Inspection, type Producteur } from "../lib/api.js";
import { DetailPanel, ErrorBanner, EmptyState } from "@jumelle/ui";

export default function InspectionsList() {
  const [inspections, setInspections] = useState<Inspection[] | null>(null);
  const [producteurs, setProducteurs] = useState<Producteur[]>([]);
  const [error, setError] = useState<unknown>(null);
  const [detail, setDetail] = useState<Inspection | null>(null);

  useEffect(() => {
    Promise.all([fetchInspections(), fetchProducteurs()])
      .then(([i, p]) => {
        setInspections(i);
        setProducteurs(p);
      })
      .catch(setError);
  }, []);

  const producteurById = useMemo(() => new Map(producteurs.map((p) => [p.id, p])), [producteurs]);
  const conformes = useMemo(() => (inspections ?? []).filter((i) => i.conforme).length, [inspections]);
  const detailProducteur = detail ? producteurById.get(detail.producteurId) : null;

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold mb-1">Audit Interne — Inspections de terrain</h1>
      <p className="text-neutral-500 mb-4">
        {inspections
          ? `${inspections.length} inspection(s) — ${conformes} conforme(s), ${inspections.length - conformes} non conforme(s)`
          : "Chargement…"}
      </p>
      <ErrorBanner error={error} />

      {inspections && inspections.length === 0 && (
        <EmptyState message="Aucune inspection pour le moment." />
      )}

      {inspections && inspections.length > 0 && (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm border-collapse">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2 pr-4">Date</th>
                <th className="py-2 pr-4">Producteur</th>
                <th className="py-2 pr-4">Score</th>
                <th className="py-2 pr-4">Verdict</th>
                <th className="py-2 pr-4">Appareil</th>
                <th className="py-2 pr-4">Détails</th>
              </tr>
            </thead>
            <tbody>
              {inspections.map((insp) => {
                const producteur = producteurById.get(insp.producteurId);
                return (
                  <tr key={insp.id} className="border-b">
                    <td className="py-2 pr-4">{insp.dateInspection}</td>
                    <td className="py-2 pr-4">
                      {producteur ? `${producteur.nom} ${producteur.prenom}` : insp.producteurId.slice(0, 8)}
                    </td>
                    <td className="py-2 pr-4 font-semibold">{insp.scoreGlobal}/100</td>
                    <td className="py-2 pr-4">
                      {insp.conforme ? (
                        <span className="text-emerald-700">✔ Conforme</span>
                      ) : (
                        <span className="text-red-600">Non conforme</span>
                      )}
                    </td>
                    <td className="py-2 pr-4 font-mono text-xs">{insp.deviceCode}</td>
                    <td className="py-2 pr-4">
                      <button className="text-emerald-700 underline" onClick={() => setDetail(insp)}>
                        Voir
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {detail && (
        <DetailPanel
          title={
            <>
              Inspection du {detail.dateInspection}
              {detailProducteur ? ` — ${detailProducteur.nom} ${detailProducteur.prenom}` : ""}
            </>
          }
          subtitle={
            <>
              Score : <span className="font-semibold">{detail.scoreGlobal}/100</span> —{" "}
              {detail.conforme ? (
                <span className="text-emerald-700">✔ Conforme</span>
              ) : (
                <span className="text-red-600">Non conforme</span>
              )}
            </>
          }
          onClose={() => setDetail(null)}
        >
          <div className="grid grid-cols-2 gap-x-8 gap-y-1 max-w-2xl text-sm mb-2">
            <span>État phytosanitaire : {detail.etatPhytosanitaire}/5</span>
            <span>Pratiques d'entretien : {detail.pratiquesEntretien}/5</span>
            <span>Fertilisation &amp; sol : {detail.fertilisationSol}/5</span>
            <span>Gestion de l'eau : {detail.gestionEau}/5</span>
            <span>Bonnes pratiques (GAP) : {detail.bonnesPratiques}/5</span>
            <span>Conformité environnementale : {detail.conformiteEnvironnementale}/5</span>
            <span>Conditions de travail : {detail.conditionsTravail}/5</span>
          </div>
          <p className="text-neutral-700">
            <span className="font-medium">Recommandations :</span> {detail.recommandations}
          </p>
        </DetailPanel>
      )}
    </div>
  );
}
