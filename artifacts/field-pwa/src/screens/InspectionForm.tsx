import { useEffect, useMemo, useState } from "react";
import {
  inspectionSyncSchema,
  computeInspectionScore,
  INSPECTION_CRITERES,
  type InspectionScores,
} from "@jumelle/shared";
import { getSessionCache } from "../lib/sessionCache.js";
import { powerSyncDb } from "../powersync/client.js";
import { Button, ErrorBanner, formInputClass } from "@jumelle/ui";

interface ProducteurOption {
  id: string;
  producerCode: string;
  nom: string;
  prenom: string;
}

interface ParcelleOption {
  id: string;
  latitude: number;
  longitude: number;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

const DEFAULT_SCORES: InspectionScores = {
  etatPhytosanitaire: 3,
  pratiquesEntretien: 3,
  fertilisationSol: 3,
  gestionEau: 3,
  bonnesPratiques: 3,
  conformiteEnvironnementale: 3,
  conditionsTravail: 3,
};

const fieldClass = "flex flex-col gap-1 text-sm";

export default function InspectionForm() {
  const [producteurs, setProducteurs] = useState<ProducteurOption[]>([]);
  const [parcelles, setParcelles] = useState<ParcelleOption[]>([]);
  const [producteurId, setProducteurId] = useState("");
  const [parcelleId, setParcelleId] = useState("");
  const [dateInspection, setDateInspection] = useState(today());
  const [scores, setScores] = useState<InspectionScores>(DEFAULT_SCORES);
  const [recommandations, setRecommandations] = useState("");
  const [error, setError] = useState<unknown>(null);
  const [submitting, setSubmitting] = useState(false);
  // Duplicate-submission guard: after a successful save, the form is
  // replaced by a success view until the agronome explicitly starts a new
  // inspection — a stale re-render of the same form can't be re-submitted.
  const [justSubmitted, setJustSubmitted] = useState<{ score: number; conforme: boolean } | null>(null);

  useEffect(() => {
    void powerSyncDb
      .getAll<ProducteurOption>("SELECT id, producerCode, nom, prenom FROM producteurs ORDER BY nom, prenom")
      .then(setProducteurs);
  }, [justSubmitted]);

  useEffect(() => {
    setParcelleId("");
    if (!producteurId) {
      setParcelles([]);
      return;
    }
    void powerSyncDb
      .getAll<ParcelleOption>("SELECT id, latitude, longitude FROM parcelles WHERE producteurId = ?", [producteurId])
      .then(setParcelles);
  }, [producteurId]);

  const { scoreGlobal, conforme } = useMemo(() => computeInspectionScore(scores), [scores]);

  function setScore(key: keyof InspectionScores, value: number) {
    setScores((s) => ({ ...s, [key]: value }));
  }

  function startNew() {
    setProducteurId("");
    setParcelleId("");
    setScores(DEFAULT_SCORES);
    setRecommandations("");
    setDateInspection(today());
    setJustSubmitted(null);
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      const session = getSessionCache();
      if (!session) throw new Error("Session non initialisée — reconnectez-vous une fois en ligne.");

      const payload = inspectionSyncSchema.parse({
        id: crypto.randomUUID(),
        cooperativeId: session.cooperativeId,
        producteurId,
        parcelleId: parcelleId || null,
        dateInspection,
        ...scores,
        recommandations: recommandations.trim(),
        agronomeId: session.agronomeId,
        deviceCode: session.deviceCode,
        createdOfflineAt: new Date().toISOString(),
      });

      await powerSyncDb.execute(
        `INSERT INTO inspections (id, cooperativeId, producteurId, parcelleId, dateInspection,
          etatPhytosanitaire, pratiquesEntretien, fertilisationSol, gestionEau, bonnesPratiques,
          conformiteEnvironnementale, conditionsTravail, scoreGlobal, conforme, recommandations,
          agronomeId, deviceCode, createdOfflineAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          payload.id,
          payload.cooperativeId,
          payload.producteurId,
          payload.parcelleId ?? null,
          payload.dateInspection,
          payload.etatPhytosanitaire,
          payload.pratiquesEntretien,
          payload.fertilisationSol,
          payload.gestionEau,
          payload.bonnesPratiques,
          payload.conformiteEnvironnementale,
          payload.conditionsTravail,
          scoreGlobal, // display-only locally — the server recomputes from the criteria
          conforme ? 1 : 0,
          payload.recommandations,
          payload.agronomeId,
          payload.deviceCode,
          payload.createdOfflineAt,
        ],
      );

      setJustSubmitted({ score: scoreGlobal, conforme });
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
        <h2 className="text-lg font-semibold">Inspection enregistrée</h2>
        <p className="text-neutral-600">
          Score {justSubmitted.score}/100 — {justSubmitted.conforme ? "Conforme" : "Non conforme"}
        </p>
        <Button size="md" onClick={startNew}>
          + Nouvelle inspection
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto p-6 flex flex-col gap-4">
      <h2 className="text-lg font-semibold">Inspection de terrain</h2>

      <label className={fieldClass}>
        Producteur à inspecter
        <select className={formInputClass} value={producteurId} onChange={(e) => setProducteurId(e.target.value)}>
          <option value="">— Sélectionner —</option>
          {producteurs.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nom} {p.prenom} ({p.producerCode})
            </option>
          ))}
        </select>
      </label>

      {parcelles.length > 0 && (
        <label className={fieldClass}>
          Parcelle (optionnel)
          <select className={formInputClass} value={parcelleId} onChange={(e) => setParcelleId(e.target.value)}>
            <option value="">— Toutes / non précisée —</option>
            {parcelles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.latitude.toFixed(4)}, {p.longitude.toFixed(4)}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className={fieldClass}>
        Date d'inspection
        <input
          className={formInputClass}
          type="date"
          value={dateInspection}
          onChange={(e) => setDateInspection(e.target.value)}
        />
      </label>

      <div>
        <h3 className="font-medium mb-0">Grille d'évaluation agronomique</h3>
        <p className="text-neutral-500 text-sm mt-0">Notez chaque critère de 0 (critique) à 5 (excellent)</p>
      </div>

      {INSPECTION_CRITERES.map((critere) => (
        <label key={critere.key} className={fieldClass}>
          {critere.label}
          <input
            type="range"
            min={0}
            max={5}
            step={1}
            value={scores[critere.key]}
            onChange={(e) => setScore(critere.key, Number(e.target.value))}
          />
          <span className="flex justify-between text-neutral-500 text-xs">
            <span>0 — Critique</span>
            <strong className="text-emerald-700">{scores[critere.key]}</strong>
            <span>5 — Excellent</span>
          </span>
        </label>
      ))}

      <div
        className={`p-3 rounded flex justify-between items-center ${conforme ? "bg-emerald-50" : "bg-red-50"}`}
      >
        <span>Score global calculé</span>
        <strong className={`text-lg ${conforme ? "text-emerald-700" : "text-red-700"}`}>
          {scoreGlobal}/100 — {conforme ? "Conforme" : "Non conforme"}
        </strong>
      </div>

      <label className={fieldClass}>
        Conseils &amp; recommandations de l'agronome
        <textarea
          className={`${formInputClass} min-h-[90px]`}
          value={recommandations}
          onChange={(e) => setRecommandations(e.target.value)}
          placeholder="Ex : Renforcer l'ombrage, traiter la rouille orangée, planifier une taille sanitaire…"
        />
      </label>

      <Button size="md" onClick={handleSubmit} disabled={submitting || !producteurId || !recommandations.trim()}>
        {submitting ? "Enregistrement…" : "Enregistrer l'inspection"}
      </Button>

      <ErrorBanner error={error} />
    </div>
  );
}
