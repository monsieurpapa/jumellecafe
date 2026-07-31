import { useEffect, useMemo, useState } from "react";
import {
  fetchLots,
  fetchLotDetail,
  createLot,
  updateLot,
  fetchStations,
  fetchLivraisons,
  type Lot,
  type LotDetail,
  type Station,
  type Livraison,
} from "../lib/api.js";
import { Badge, Button, ConfirmButton, DetailPanel, ErrorBanner, SuccessBanner, EmptyState, PageHeader, SkeletonRows, formInputClass } from "@jumelle/ui";

const STATUT_LABELS: Record<Lot["statut"], string> = {
  en_traitement: "En traitement",
  pret_export: "Prêt export",
  exporte: "Exporté",
};

const ERROR_MESSAGES: Record<string, string> = {
  unknown_station: "Station introuvable pour cette coopérative.",
  unknown_livraisons: "Une ou plusieurs livraisons sélectionnées sont introuvables.",
  livraisons_not_from_station: "Certaines livraisons sélectionnées n'appartiennent pas à cette station.",
  livraisons_already_lotted: "Certaines livraisons sélectionnées font déjà partie d'un autre lot.",
};

export default function LotsList({ canWrite }: { canWrite: boolean }) {
  const [lots, setLots] = useState<Lot[] | null>(null);
  const [stations, setStations] = useState<Station[]>([]);
  const [error, setError] = useState<unknown>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [detail, setDetail] = useState<LotDetail | null>(null);

  // Constitution flow state
  const [showForm, setShowForm] = useState(false);
  const [formStation, setFormStation] = useState("");
  const [formCulture, setFormCulture] = useState("");
  const [formAcheteur, setFormAcheteur] = useState("");
  const [formPays, setFormPays] = useState("");
  const [candidates, setCandidates] = useState<Livraison[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  function load() {
    fetchLots()
      .then(setLots)
      .catch(setError);
  }

  useEffect(() => {
    load();
    fetchStations()
      .then(setStations)
      .catch(setError);
  }, []);

  useEffect(() => {
    if (!formStation) {
      setCandidates([]);
      setSelected(new Set());
      return;
    }
    fetchLivraisons(formStation)
      .then((rows) => {
        setCandidates(rows.filter((l) => l.lotId === null));
        setSelected(new Set());
      })
      .catch(setError);
  }, [formStation]);

  const stationById = useMemo(() => new Map(stations.map((s) => [s.id, s])), [stations]);
  const selectedKg = useMemo(
    () => candidates.filter((l) => selected.has(l.id)).reduce((sum, l) => sum + l.poidsKg, 0),
    [candidates, selected],
  );

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleCreate() {
    setSaving(true);
    setError(null);
    try {
      const culture = formCulture.trim();
      await createLot({
        stationId: formStation,
        culture,
        livraisonIds: [...selected],
        acheteur: formAcheteur.trim() || undefined,
        paysDestination: formPays.trim() || undefined,
      });
      setShowForm(false);
      setFormStation("");
      setFormCulture("");
      setFormAcheteur("");
      setFormPays("");
      setSuccess(`Lot « ${culture} » constitué.`);
      load();
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  }

  async function openDetail(lotId: string) {
    setDetail(null);
    try {
      setDetail(await fetchLotDetail(lotId));
    } catch (err) {
      setError(err);
    }
  }

  async function advanceStatut(lot: Lot) {
    const next: Lot["statut"] = lot.statut === "en_traitement" ? "pret_export" : "exporte";
    try {
      await updateLot(lot.id, {
        statut: next,
        ...(next === "exporte" ? { dateExport: new Date().toISOString().slice(0, 10) } : {}),
      });
      setSuccess(`Lot « ${lot.code} » → ${STATUT_LABELS[next]}.`);
      load();
    } catch (err) {
      setError(err);
    }
  }

  return (
    <div className="p-6">
      <PageHeader
        title="Traçabilité — Lots"
        subtitle={lots ? `${lots.length} lot(s)` : undefined}
        action={
          canWrite && (
            <Button onClick={() => setShowForm((v) => !v)}>{showForm ? "Annuler" : "+ Constituer un lot"}</Button>
          )
        }
      />
      <ErrorBanner error={error} messages={ERROR_MESSAGES} />
      <SuccessBanner message={success} onDismiss={() => setSuccess(null)} />

      {canWrite && showForm && (
        <div className="border border-stone-200 shadow-sm rounded-lg p-4 mb-6 max-w-3xl bg-white">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <label className="text-sm">
              Station *
              <select className={formInputClass} value={formStation} onChange={(e) => setFormStation(e.target.value)}>
                <option value="">— Sélectionner —</option>
                {stations.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nom} ({s.code})
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              Culture *
              <input
                className={formInputClass}
                value={formCulture}
                onChange={(e) => setFormCulture(e.target.value)}
                placeholder="Arabica Lavé"
              />
            </label>
            <label className="text-sm">
              Acheteur
              <input className={formInputClass} value={formAcheteur} onChange={(e) => setFormAcheteur(e.target.value)} />
            </label>
            <label className="text-sm">
              Pays de destination
              <input className={formInputClass} value={formPays} onChange={(e) => setFormPays(e.target.value)} />
            </label>
          </div>

          {formStation && (
            <>
              <p className="text-sm font-medium mb-1">
                Livraisons disponibles ({candidates.length}) — sélection : {selected.size} bon(s),{" "}
                {selectedKg.toLocaleString("fr-FR")} kg
              </p>
              {candidates.length === 0 && (
                <p className="text-sm text-stone-500 mb-2">Aucune livraison non-lotie pour cette station.</p>
              )}
              <div className="max-h-56 overflow-y-auto border border-stone-200 rounded-md mb-3">
                {candidates.map((l) => (
                  <label key={l.id} className="flex items-center gap-2 px-3 py-1.5 border-b text-sm cursor-pointer">
                    <input type="checkbox" checked={selected.has(l.id)} onChange={() => toggle(l.id)} />
                    <span className="font-mono text-xs">{l.bonNumber}</span>
                    <span>{l.dateLivraison}</span>
                    <span>{l.produit === "cerises" ? "Cerises" : "Parche"}</span>
                    <span className="ml-auto">{l.poidsKg} kg</span>
                  </label>
                ))}
              </div>
            </>
          )}

          <Button
            size="md"
            disabled={saving || !formStation || !formCulture.trim() || selected.size === 0}
            onClick={handleCreate}
          >
            {saving ? "Constitution…" : `Constituer le lot (${selectedKg.toLocaleString("fr-FR")} kg)`}
          </Button>
        </div>
      )}

      {!lots && <SkeletonRows cols={7} />}

      {lots && lots.length === 0 && (
        <EmptyState
          icon="lot"
          message="Aucun lot constitué pour le moment"
          description="Constituez un lot à partir des livraisons non-loties d'une station pour démarrer la traçabilité export."
        />
      )}

      {lots && lots.length > 0 && (
        <div className="overflow-x-auto border border-stone-200 shadow-sm rounded-lg bg-white">
          <table className="min-w-full text-sm border-collapse">
            <thead>
              <tr className="text-left border-b border-stone-200 bg-stone-50">
                <th className="py-2 px-4">Lot</th>
                <th className="py-2 px-4">Culture</th>
                <th className="py-2 px-4">Poids (kg)</th>
                <th className="py-2 px-4">Station</th>
                <th className="py-2 px-4">Producteurs</th>
                <th className="py-2 px-4">EUDR</th>
                <th className="py-2 px-4">Acheteur</th>
                <th className="py-2 px-4">Statut</th>
                <th className="py-2 px-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {lots.map((lot) => (
                <tr key={lot.id} className="border-b border-stone-100 last:border-0 hover:bg-stone-50 transition-colors">
                  <td className="py-2 px-4 font-mono text-xs">{lot.code}</td>
                  <td className="py-2 px-4">{lot.culture}</td>
                  <td className="py-2 px-4">{lot.poidsKg.toLocaleString("fr-FR")}</td>
                  <td className="py-2 px-4">{stationById.get(lot.stationId)?.nom ?? "—"}</td>
                  <td className="py-2 px-4">{lot.producteursCount} prod.</td>
                  <td className="py-2 px-4">
                    <Badge variant={lot.eudrConforme ? "success" : "danger"}>
                      {lot.eudrConforme ? "✔ Conforme" : "Non conforme"}
                    </Badge>
                  </td>
                  <td className="py-2 px-4">{lot.acheteur ?? "—"}</td>
                  <td className="py-2 px-4">
                    <Badge variant={lot.statut === "exporte" ? "success" : lot.statut === "pret_export" ? "warning" : "neutral"}>
                      {STATUT_LABELS[lot.statut]}
                    </Badge>
                  </td>
                  <td className="py-2 px-4">
                    <button
                      className="text-emerald-700 hover:text-emerald-900 underline transition-colors mr-3"
                      onClick={() => openDetail(lot.id)}
                    >
                      Voir
                    </button>
                    {canWrite && lot.statut !== "exporte" && (
                      <ConfirmButton
                        label={lot.statut === "en_traitement" ? "→ Prêt export" : "→ Exporté"}
                        confirmLabel="Confirmer ?"
                        onConfirm={() => advanceStatut(lot)}
                      />
                    )}
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
              Chaîne de traçabilité — <span className="font-mono text-sm">{detail.lot.code}</span>
            </>
          }
          subtitle={
            <>
              {detail.lot.culture} · {detail.lot.poidsKg.toLocaleString("fr-FR")} kg ·{" "}
              {detail.lot.eudrConforme ? "EUDR conforme" : "EUDR non conforme"} · {detail.parcelles.length} parcelle(s)
              GPS
            </>
          }
          onClose={() => setDetail(null)}
        >
          <table className="min-w-full text-sm border-collapse">
            <thead>
              <tr className="text-left border-b border-stone-200">
                <th className="py-1.5 pr-4">Bon N°</th>
                <th className="py-1.5 pr-4">Date</th>
                <th className="py-1.5 pr-4">Producteur</th>
                <th className="py-1.5 pr-4">Code producteur</th>
                <th className="py-1.5 pr-4">Produit</th>
                <th className="py-1.5 pr-4">Poids (kg)</th>
                <th className="py-1.5 pr-4">Parcelles GPS</th>
              </tr>
            </thead>
            <tbody>
              {detail.livraisons.map(({ livraison, producteur }) => {
                const coords = detail.parcelles
                  .filter((p) => p.producteurId === producteur.id)
                  .map((p) => `${p.latitude.toFixed(4)}, ${p.longitude.toFixed(4)}`);
                return (
                  <tr key={livraison.id} className="border-b border-stone-100 last:border-0">
                    <td className="py-1.5 pr-4 font-mono text-xs">{livraison.bonNumber}</td>
                    <td className="py-1.5 pr-4">{livraison.dateLivraison}</td>
                    <td className="py-1.5 pr-4">
                      {producteur.nom} {producteur.prenom}
                    </td>
                    <td className="py-1.5 pr-4 font-mono text-xs">{producteur.producerCode}</td>
                    <td className="py-1.5 pr-4">{livraison.produit === "cerises" ? "Cerises" : "Parche"}</td>
                    <td className="py-1.5 pr-4">{livraison.poidsKg}</td>
                    <td className="py-1.5 pr-4 font-mono text-xs">{coords.length ? coords.join(" · ") : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </DetailPanel>
      )}
    </div>
  );
}
