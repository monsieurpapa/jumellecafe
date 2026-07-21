import { useEffect, useState } from "react";
import { livraisonSyncSchema, generateBonLivraison } from "@jumelle/shared";
import { getSessionCache } from "../lib/sessionCache.js";
import { nextBonSequence } from "../powersync/localCounters.js";
import { powerSyncDb } from "../powersync/client.js";
import { Button, ErrorBanner, formInputClass } from "@jumelle/ui";

interface ProducteurOption {
  id: string;
  producerCode: string;
  nom: string;
  prenom: string;
}

interface StationOption {
  id: string;
  code: string;
  nom: string;
  statut: string;
}

interface FormState {
  producteurId: string;
  stationId: string;
  produit: "cerises" | "parche" | "";
  poidsKg: string;
  prixUnitaireCdf: string;
  dateLivraison: string;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function emptyForm(carryStationId = "", carryDate = today()): FormState {
  return {
    producteurId: "",
    stationId: carryStationId,
    produit: "",
    poidsKg: "",
    prixUnitaireCdf: "",
    dateLivraison: carryDate,
  };
}

const fieldClass = "flex flex-col gap-1 text-sm";

export default function LivraisonForm() {
  const [form, setForm] = useState<FormState>(emptyForm());
  const [producteurs, setProducteurs] = useState<ProducteurOption[]>([]);
  const [stations, setStations] = useState<StationOption[]>([]);
  const [error, setError] = useState<unknown>(null);
  const [submitting, setSubmitting] = useState(false);
  // Duplicate-submission guard: after a successful save, the form is
  // replaced by a success view until the agronome explicitly starts a new
  // bon — a stale re-render of the same form can no longer be re-submitted.
  const [justSubmitted, setJustSubmitted] = useState<string | null>(null);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  useEffect(() => {
    // Both lists come from the local PowerSync mirror — fully offline.
    void powerSyncDb
      .getAll<ProducteurOption>("SELECT id, producerCode, nom, prenom FROM producteurs ORDER BY nom, prenom")
      .then(setProducteurs);
    void powerSyncDb
      .getAll<StationOption>("SELECT id, code, nom, statut FROM stations WHERE statut != 'inactive' ORDER BY nom")
      .then(setStations);
  }, [justSubmitted]);

  function startNew() {
    setForm((f) => emptyForm(f.stationId, f.dateLivraison));
    setJustSubmitted(null);
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      const session = getSessionCache();
      if (!session) throw new Error("Session non initialisée — reconnectez-vous une fois en ligne.");

      const sequence = await nextBonSequence(session.deviceCode);
      const bonNumber = generateBonLivraison({
        coopCode: session.coopCode,
        deviceCode: session.deviceCode,
        sequence,
      });

      const payload = livraisonSyncSchema.parse({
        id: crypto.randomUUID(),
        cooperativeId: session.cooperativeId,
        producteurId: form.producteurId,
        stationId: form.stationId,
        bonNumber,
        produit: form.produit,
        poidsKg: Number(form.poidsKg),
        prixUnitaireCdf: form.prixUnitaireCdf ? Number(form.prixUnitaireCdf) : null,
        dateLivraison: form.dateLivraison,
        agronomeId: session.agronomeId,
        deviceCode: session.deviceCode,
        createdOfflineAt: new Date().toISOString(),
      });

      await powerSyncDb.execute(
        `INSERT INTO livraisons (id, cooperativeId, producteurId, stationId, bonNumber, produit, poidsKg,
          prixUnitaireCdf, dateLivraison, agronomeId, deviceCode, createdOfflineAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          payload.id,
          payload.cooperativeId,
          payload.producteurId,
          payload.stationId,
          payload.bonNumber,
          payload.produit,
          payload.poidsKg,
          payload.prixUnitaireCdf ?? null,
          payload.dateLivraison,
          payload.agronomeId,
          payload.deviceCode,
          payload.createdOfflineAt,
        ],
      );

      setJustSubmitted(bonNumber);
    } catch (err) {
      setError(err);
    } finally {
      setSubmitting(false);
    }
  }

  if (justSubmitted) {
    return (
      <div className="max-w-md mx-auto p-6 flex flex-col gap-4 items-center text-center">
        <div className="rounded-full bg-emerald-100 text-emerald-700 w-12 h-12 flex items-center justify-center text-2xl">
          ✓
        </div>
        <h2 className="text-lg font-semibold">Livraison enregistrée</h2>
        <p className="text-neutral-600">
          Bon N° : <span className="font-mono">{justSubmitted}</span>
        </p>
        <Button size="md" onClick={startNew}>
          + Nouvelle livraison
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto p-6 flex flex-col gap-4">
      <h2 className="text-lg font-semibold">Bon de livraison</h2>

      {stations.length === 0 && (
        <p className="text-amber-700 text-sm">
          Aucune station synchronisée. L'Admin Coopérative doit d'abord enregistrer les stations de lavage (une
          connexion est nécessaire pour la première synchronisation).
        </p>
      )}

      <label className={fieldClass}>
        Producteur
        <select
          className={formInputClass}
          value={form.producteurId}
          onChange={(e) => set("producteurId", e.target.value)}
        >
          <option value="">— Sélectionner —</option>
          {producteurs.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nom} {p.prenom} ({p.producerCode})
            </option>
          ))}
        </select>
      </label>

      <label className={fieldClass}>
        Station de lavage / point de collecte
        <select className={formInputClass} value={form.stationId} onChange={(e) => set("stationId", e.target.value)}>
          <option value="">— Sélectionner —</option>
          {stations.map((s) => (
            <option key={s.id} value={s.id}>
              {s.nom} ({s.code})
            </option>
          ))}
        </select>
      </label>

      <label className={fieldClass}>
        Produit
        <select
          className={formInputClass}
          value={form.produit}
          onChange={(e) => set("produit", e.target.value as FormState["produit"])}
        >
          <option value="">— Sélectionner —</option>
          <option value="cerises">Cerises</option>
          <option value="parche">Parche</option>
        </select>
      </label>

      <label className={fieldClass}>
        Poids (kg)
        <input
          className={formInputClass}
          type="number"
          step="0.1"
          value={form.poidsKg}
          onChange={(e) => set("poidsKg", e.target.value)}
        />
      </label>

      <label className={fieldClass}>
        Prix unitaire (CDF/kg) — optionnel
        <input
          className={formInputClass}
          type="number"
          value={form.prixUnitaireCdf}
          onChange={(e) => set("prixUnitaireCdf", e.target.value)}
        />
      </label>

      <label className={fieldClass}>
        Date de livraison
        <input
          className={formInputClass}
          type="date"
          value={form.dateLivraison}
          onChange={(e) => set("dateLivraison", e.target.value)}
        />
      </label>

      <Button
        size="md"
        onClick={handleSubmit}
        disabled={submitting || !form.producteurId || !form.stationId || !form.produit || !form.poidsKg}
      >
        {submitting ? "Enregistrement…" : "Enregistrer la livraison"}
      </Button>

      <ErrorBanner error={error} />
    </div>
  );
}
