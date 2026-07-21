import { useEffect, useState } from "react";
import { fetchStations, createStation, updateStation, type Station, type CreateStationInput } from "../lib/api.js";
import { Button, DetailPanel, ErrorBanner, SuccessBanner, EmptyState, formInputClass } from "@jumelle/ui";

interface FormState {
  code: string;
  nom: string;
  type: "lavage" | "collecte";
  village: string;
  territoire: string;
  latitude: string;
  longitude: string;
  altitudeM: string;
  capaciteTonnesSaison: string;
  responsableNom: string;
  responsableTelephone: string;
  sourceEau: string;
  certifications: string;
  produits: string;
}

const EMPTY_FORM: FormState = {
  code: "",
  nom: "",
  type: "lavage",
  village: "",
  territoire: "",
  latitude: "",
  longitude: "",
  altitudeM: "",
  capaciteTonnesSaison: "",
  responsableNom: "",
  responsableTelephone: "",
  sourceEau: "",
  certifications: "",
  produits: "",
};

const STATUT_LABELS: Record<Station["statut"], string> = {
  active: "Active",
  partielle: "Partielle",
  inactive: "Inactive",
};

const ERROR_MESSAGES: Record<string, string> = {
  station_code_conflict: "Ce code station existe déjà pour cette coopérative.",
};

export default function StationsList({ canWrite }: { canWrite: boolean }) {
  const [stations, setStations] = useState<Station[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [detail, setDetail] = useState<Station | null>(null);
  // Statut change is confirm-then-commit, not instant: the select only stages
  // the next value; the row shows a confirm/cancel pair until acted on.
  const [pendingChange, setPendingChange] = useState<{ stationId: string; statut: Station["statut"] } | null>(null);
  const [applyingStatutId, setApplyingStatutId] = useState<string | null>(null);

  function load() {
    fetchStations()
      .then(setStations)
      .catch(setError);
  }

  useEffect(load, []);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleCreate() {
    setSaving(true);
    setError(null);
    try {
      const input: CreateStationInput = {
        code: form.code.trim(),
        nom: form.nom.trim(),
        type: form.type,
        village: form.village.trim() || undefined,
        territoire: form.territoire.trim() || undefined,
        latitude: form.latitude ? Number(form.latitude) : undefined,
        longitude: form.longitude ? Number(form.longitude) : undefined,
        altitudeM: form.altitudeM ? Number(form.altitudeM) : undefined,
        capaciteTonnesSaison: form.capaciteTonnesSaison ? Number(form.capaciteTonnesSaison) : undefined,
        responsableNom: form.responsableNom.trim() || undefined,
        responsableTelephone: form.responsableTelephone.trim() || undefined,
        sourceEau: form.sourceEau.trim() || undefined,
        certifications: form.certifications.trim() || undefined,
        produits: form.produits.trim() || undefined,
      };
      await createStation(input);
      setForm(EMPTY_FORM);
      setShowForm(false);
      setSuccess(`Station « ${input.nom} » enregistrée.`);
      load();
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  }

  async function confirmStatutChange(station: Station) {
    if (!pendingChange || pendingChange.stationId !== station.id) return;
    const statut = pendingChange.statut;
    setError(null);
    setApplyingStatutId(station.id);
    try {
      await updateStation(station.id, { statut });
      setSuccess(`Statut de « ${station.nom} » mis à jour.`);
      setPendingChange(null);
      load();
    } catch (err) {
      setError(err);
    } finally {
      setApplyingStatutId(null);
    }
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-xl font-semibold">Stations de lavage &amp; points de collecte</h1>
        {canWrite && <Button onClick={() => setShowForm((v) => !v)}>{showForm ? "Annuler" : "+ Enregistrer une station"}</Button>}
      </div>
      <p className="text-neutral-500 mb-4">{stations ? `${stations.length} station(s)` : "Chargement…"}</p>
      <ErrorBanner error={error} messages={ERROR_MESSAGES} />
      <SuccessBanner message={success} onDismiss={() => setSuccess(null)} />

      {canWrite && showForm && (
        <div className="border rounded p-4 mb-6 grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl">
          <label className="text-sm">
            Code *
            <input className={formInputClass} value={form.code} onChange={(e) => set("code", e.target.value)} placeholder="C-KALEHE-A" />
          </label>
          <label className="text-sm">
            Nom *
            <input className={formInputClass} value={form.nom} onChange={(e) => set("nom", e.target.value)} placeholder="Station Kalehe Nord" />
          </label>
          <label className="text-sm">
            Type
            <select className={formInputClass} value={form.type} onChange={(e) => set("type", e.target.value as FormState["type"])}>
              <option value="lavage">Station de lavage</option>
              <option value="collecte">Point de collecte</option>
            </select>
          </label>
          <label className="text-sm">
            Capacité (T/saison)
            <input className={formInputClass} type="number" value={form.capaciteTonnesSaison} onChange={(e) => set("capaciteTonnesSaison", e.target.value)} />
          </label>
          <label className="text-sm">
            Village
            <input className={formInputClass} value={form.village} onChange={(e) => set("village", e.target.value)} />
          </label>
          <label className="text-sm">
            Territoire
            <input className={formInputClass} value={form.territoire} onChange={(e) => set("territoire", e.target.value)} />
          </label>
          <label className="text-sm">
            Latitude
            <input className={formInputClass} type="number" step="0.000001" value={form.latitude} onChange={(e) => set("latitude", e.target.value)} />
          </label>
          <label className="text-sm">
            Longitude
            <input className={formInputClass} type="number" step="0.000001" value={form.longitude} onChange={(e) => set("longitude", e.target.value)} />
          </label>
          <label className="text-sm">
            Altitude (m)
            <input className={formInputClass} type="number" step="0.01" value={form.altitudeM} onChange={(e) => set("altitudeM", e.target.value)} />
          </label>
          <label className="text-sm">
            Source d'eau
            <input className={formInputClass} value={form.sourceEau} onChange={(e) => set("sourceEau", e.target.value)} placeholder="Rivière, forage…" />
          </label>
          <label className="text-sm">
            Responsable
            <input className={formInputClass} value={form.responsableNom} onChange={(e) => set("responsableNom", e.target.value)} />
          </label>
          <label className="text-sm">
            Téléphone responsable
            <input className={formInputClass} value={form.responsableTelephone} onChange={(e) => set("responsableTelephone", e.target.value)} />
          </label>
          <label className="text-sm">
            Certifications
            <input className={formInputClass} value={form.certifications} onChange={(e) => set("certifications", e.target.value)} placeholder="Bio, EUDR, RainForest" />
          </label>
          <label className="text-sm">
            Produits
            <input className={formInputClass} value={form.produits} onChange={(e) => set("produits", e.target.value)} placeholder="Arabica Cerises, Parche" />
          </label>
          <div className="sm:col-span-2">
            <Button size="md" disabled={saving || !form.code.trim() || !form.nom.trim()} onClick={handleCreate}>
              {saving ? "Enregistrement…" : "Enregistrer la station"}
            </Button>
          </div>
        </div>
      )}

      {stations && stations.length === 0 && <EmptyState message="Aucune station enregistrée pour le moment." />}

      {stations && stations.length > 0 && (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm border-collapse">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2 pr-4">Code</th>
                <th className="py-2 pr-4">Nom</th>
                <th className="py-2 pr-4">Type</th>
                <th className="py-2 pr-4">Village</th>
                <th className="py-2 pr-4">Territoire</th>
                <th className="py-2 pr-4">Capacité (T/saison)</th>
                <th className="py-2 pr-4">Responsable</th>
                <th className="py-2 pr-4">Statut</th>
                <th className="py-2 pr-4">Détails</th>
              </tr>
            </thead>
            <tbody>
              {stations.map((s) => (
                <tr key={s.id} className="border-b">
                  <td className="py-2 pr-4 font-mono text-xs">{s.code}</td>
                  <td className="py-2 pr-4">{s.nom}</td>
                  <td className="py-2 pr-4">{s.type === "lavage" ? "Lavage" : "Collecte"}</td>
                  <td className="py-2 pr-4">{s.village ?? "—"}</td>
                  <td className="py-2 pr-4">{s.territoire ?? "—"}</td>
                  <td className="py-2 pr-4">{s.capaciteTonnesSaison ?? "—"}</td>
                  <td className="py-2 pr-4">{s.responsableNom ?? "—"}</td>
                  <td className="py-2 pr-4">
                    {canWrite ? (
                      pendingChange?.stationId === s.id ? (
                        <span className="inline-flex items-center gap-2 text-xs">
                          <span>→ {STATUT_LABELS[pendingChange.statut]} ?</span>
                          <button
                            className="text-red-600 underline disabled:opacity-50"
                            disabled={applyingStatutId === s.id}
                            onClick={() => confirmStatutChange(s)}
                          >
                            {applyingStatutId === s.id ? "…" : "Confirmer"}
                          </button>
                          <button className="text-neutral-500 underline" onClick={() => setPendingChange(null)}>
                            Annuler
                          </button>
                        </span>
                      ) : (
                        <select
                          className="border rounded px-2 py-1 text-xs"
                          value={s.statut}
                          onChange={(e) =>
                            setPendingChange({ stationId: s.id, statut: e.target.value as Station["statut"] })
                          }
                        >
                          {Object.entries(STATUT_LABELS).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      )
                    ) : (
                      STATUT_LABELS[s.statut]
                    )}
                  </td>
                  <td className="py-2 pr-4">
                    <button className="text-emerald-700 underline" onClick={() => setDetail(s)}>
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
        <DetailPanel title={`Station — ${detail.nom}`} onClose={() => setDetail(null)}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1 max-w-2xl text-sm">
            <span>Source d'eau : {detail.sourceEau ?? "—"}</span>
            <span>Certifications : {detail.certifications ?? "—"}</span>
            <span>Produits : {detail.produits ?? "—"}</span>
            <span>
              Coordonnées :{" "}
              {detail.latitude != null && detail.longitude != null
                ? `${detail.latitude.toFixed(4)}, ${detail.longitude.toFixed(4)}`
                : "—"}
            </span>
            <span>Altitude : {detail.altitudeM != null ? `${detail.altitudeM} m` : "—"}</span>
            <span>Téléphone responsable : {detail.responsableTelephone ?? "—"}</span>
          </div>
        </DetailPanel>
      )}
    </div>
  );
}
