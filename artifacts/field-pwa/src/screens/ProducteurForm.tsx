import { useState } from "react";
import { producteurSyncSchema, parcelleSyncSchema, generateProducerCode } from "@jumelle/shared";
import { getSessionCache } from "../lib/sessionCache.js";
import { nextLocalSequence } from "../powersync/localCounters.js";
import { powerSyncDb } from "../powersync/client.js";
import { Button, ErrorBanner, formInputClass } from "@jumelle/ui";

type Step = 1 | 2 | 3;

interface FormState {
  nom: string;
  prenom: string;
  sexe: "M" | "F" | "";
  age: string;
  culturePrincipale: "cafe" | "cacao" | "";
  nombreChamps: string;
  surfaceBiologiqueHa: string;
  nombrePieds: string;
  estimationRendementKgHa: string;
  statutIcs: "biologique" | "conventionnel" | "transition" | "";
  groupement: string;
  village: string;
  territoire: string;
  province: string;
  latitude: string;
  longitude: string;
}

const EMPTY_FORM: FormState = {
  nom: "",
  prenom: "",
  sexe: "",
  age: "",
  culturePrincipale: "",
  nombreChamps: "",
  surfaceBiologiqueHa: "",
  nombrePieds: "",
  estimationRendementKgHa: "",
  statutIcs: "",
  groupement: "",
  village: "",
  territoire: "",
  province: "Sud-Kivu",
  latitude: "",
  longitude: "",
};

const fieldClass = "flex flex-col gap-1 text-sm";

const STEP_LABELS = ["Identité", "Exploitation", "Parcelle GPS"];

function StepProgress({ step }: { step: Step }) {
  return (
    <div className="flex items-center gap-2 mb-1">
      {STEP_LABELS.map((label, i) => {
        const idx = (i + 1) as Step;
        const active = idx === step;
        const done = idx < step;
        return (
          <div key={label} className="flex-1 flex flex-col items-center gap-1">
            <div
              className={`h-1.5 w-full rounded-full ${done || active ? "bg-emerald-600" : "bg-stone-200"}`}
            />
            <span className={`text-[11px] ${active ? "font-semibold text-emerald-700" : "text-stone-400"}`}>
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function ProducteurForm() {
  const [step, setStep] = useState<Step>(1);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [error, setError] = useState<unknown>(null);
  const [submitting, setSubmitting] = useState(false);
  const [locating, setLocating] = useState(false);
  // Duplicate-submission guard: once a producteur is registered, the form
  // is replaced by this success view (not re-shown re-submittable) until
  // the agronome explicitly asks to start a new entry.
  const [justSubmitted, setJustSubmitted] = useState<string | null>(null);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function startNew() {
    setForm(EMPTY_FORM);
    setStep(1);
    setJustSubmitted(null);
  }

  function captureGps() {
    setLocating(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        set("latitude", pos.coords.latitude.toFixed(6));
        set("longitude", pos.coords.longitude.toFixed(6));
        setLocating(false);
      },
      (err) => {
        setError(new Error(`GPS indisponible : ${err.message}`));
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      const session = getSessionCache();
      if (!session) throw new Error("Session non initialisée — reconnectez-vous une fois en ligne.");

      const sequence = await nextLocalSequence(session.deviceCode);
      const producerCode = generateProducerCode({
        coopCode: session.coopCode,
        deviceCode: session.deviceCode,
        sequence,
        nom: form.nom,
        prenom: form.prenom,
        groupement: form.groupement || form.village,
        village: form.village,
      });

      const producteurId = crypto.randomUUID();
      const nowIso = new Date().toISOString();

      const producteurPayload = producteurSyncSchema.parse({
        id: producteurId,
        cooperativeId: session.cooperativeId,
        producerCode,
        nom: form.nom,
        prenom: form.prenom,
        sexe: form.sexe,
        age: form.age ? Number(form.age) : null,
        dateEnregistrement: nowIso.slice(0, 10),
        culturePrincipale: form.culturePrincipale,
        nombreChamps: form.nombreChamps ? Number(form.nombreChamps) : null,
        surfaceBiologiqueHa: Number(form.surfaceBiologiqueHa),
        nombrePieds: form.nombrePieds ? Number(form.nombrePieds) : null,
        estimationRendementKgHa: form.estimationRendementKgHa ? Number(form.estimationRendementKgHa) : null,
        statutIcs: form.statutIcs,
        groupement: form.groupement || null,
        village: form.village,
        territoire: form.territoire,
        province: form.province,
        agronomeId: session.agronomeId,
        deviceCode: session.deviceCode,
        createdOfflineAt: nowIso,
      });

      await powerSyncDb.execute(
        `INSERT INTO producteurs (id, cooperativeId, producerCode, nom, prenom, sexe, age, dateEnregistrement,
          culturePrincipale, nombreChamps, surfaceBiologiqueHa, nombrePieds, estimationRendementKgHa, statutIcs,
          groupement, village, territoire, province, agronomeId, deviceCode, createdOfflineAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          producteurPayload.id,
          producteurPayload.cooperativeId,
          producteurPayload.producerCode,
          producteurPayload.nom,
          producteurPayload.prenom,
          producteurPayload.sexe,
          producteurPayload.age ?? null,
          producteurPayload.dateEnregistrement,
          producteurPayload.culturePrincipale,
          producteurPayload.nombreChamps ?? null,
          producteurPayload.surfaceBiologiqueHa,
          producteurPayload.nombrePieds ?? null,
          producteurPayload.estimationRendementKgHa ?? null,
          producteurPayload.statutIcs,
          producteurPayload.groupement ?? null,
          producteurPayload.village,
          producteurPayload.territoire,
          producteurPayload.province,
          producteurPayload.agronomeId,
          producteurPayload.deviceCode,
          producteurPayload.createdOfflineAt,
        ],
      );

      if (form.latitude && form.longitude) {
        const parcellePayload = parcelleSyncSchema.parse({
          id: crypto.randomUUID(),
          producteurId,
          cooperativeId: session.cooperativeId,
          latitude: Number(form.latitude),
          longitude: Number(form.longitude),
        });
        await powerSyncDb.execute(
          `INSERT INTO parcelles (id, producteurId, cooperativeId, latitude, longitude) VALUES (?, ?, ?, ?, ?)`,
          [
            parcellePayload.id,
            parcellePayload.producteurId,
            parcellePayload.cooperativeId,
            parcellePayload.latitude,
            parcellePayload.longitude,
          ],
        );
      }

      setJustSubmitted(producerCode);
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
        <h2 className="text-lg font-semibold tracking-tight text-stone-900">Producteur enregistré</h2>
        <p className="text-stone-600">
          Code producteur : <span className="font-mono">{justSubmitted}</span>
        </p>
        <Button size="md" onClick={startNew}>
          + Nouveau producteur
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto p-6 flex flex-col gap-4">
      <h2 className="text-lg font-semibold tracking-tight text-stone-900">Enregistrer un producteur</h2>
      <StepProgress step={step} />

      {step === 1 && (
        <div className="flex flex-col gap-3">
          <h3 className="font-medium text-stone-800">1. Identité du membre</h3>
          <label className={fieldClass}>
            Nom
            <input className={formInputClass} value={form.nom} onChange={(e) => set("nom", e.target.value)} />
          </label>
          <label className={fieldClass}>
            Prénom
            <input className={formInputClass} value={form.prenom} onChange={(e) => set("prenom", e.target.value)} />
          </label>
          <label className={fieldClass}>
            Sexe
            <select
              className={formInputClass}
              value={form.sexe}
              onChange={(e) => set("sexe", e.target.value as FormState["sexe"])}
            >
              <option value="">— Sélectionner —</option>
              <option value="M">Masculin</option>
              <option value="F">Féminin</option>
            </select>
          </label>
          <label className={fieldClass}>
            Âge
            <input
              className={formInputClass}
              type="number"
              value={form.age}
              onChange={(e) => set("age", e.target.value)}
            />
          </label>
          <Button size="md" onClick={() => setStep(2)} disabled={!form.nom || !form.prenom || !form.sexe}>
            Suivant : Exploitation agricole →
          </Button>
        </div>
      )}

      {step === 2 && (
        <div className="flex flex-col gap-3">
          <h3 className="font-medium text-stone-800">2. Exploitation agricole</h3>
          <label className={fieldClass}>
            Culture principale
            <select
              className={formInputClass}
              value={form.culturePrincipale}
              onChange={(e) => set("culturePrincipale", e.target.value as FormState["culturePrincipale"])}
            >
              <option value="">— Sélectionner —</option>
              <option value="cafe">Café</option>
              <option value="cacao">Cacao</option>
            </select>
          </label>
          <label className={fieldClass}>
            Nombre de champs
            <input
              className={formInputClass}
              type="number"
              value={form.nombreChamps}
              onChange={(e) => set("nombreChamps", e.target.value)}
            />
          </label>
          <label className={fieldClass}>
            Surface biologique (ha)
            <input
              className={formInputClass}
              type="number"
              step="0.01"
              value={form.surfaceBiologiqueHa}
              onChange={(e) => set("surfaceBiologiqueHa", e.target.value)}
            />
          </label>
          <label className={fieldClass}>
            Nombre effectif de pieds
            <input
              className={formInputClass}
              type="number"
              value={form.nombrePieds}
              onChange={(e) => set("nombrePieds", e.target.value)}
            />
          </label>
          <label className={fieldClass}>
            Estimation rendement (kg/ha)
            <input
              className={formInputClass}
              type="number"
              value={form.estimationRendementKgHa}
              onChange={(e) => set("estimationRendementKgHa", e.target.value)}
            />
          </label>
          <label className={fieldClass}>
            Statut des parcelles ICS
            <select
              className={formInputClass}
              value={form.statutIcs}
              onChange={(e) => set("statutIcs", e.target.value as FormState["statutIcs"])}
            >
              <option value="">— Sélectionner —</option>
              <option value="biologique">Biologique</option>
              <option value="conventionnel">Conventionnel</option>
              <option value="transition">Transition</option>
            </select>
          </label>
          <label className={fieldClass}>
            Groupement
            <input
              className={formInputClass}
              value={form.groupement}
              onChange={(e) => set("groupement", e.target.value)}
            />
          </label>
          <div className="flex gap-2">
            <Button size="md" className="bg-stone-500" onClick={() => setStep(1)}>
              ← Retour
            </Button>
            <Button
              size="md"
              onClick={() => setStep(3)}
              disabled={!form.culturePrincipale || !form.surfaceBiologiqueHa || !form.statutIcs}
            >
              Suivant : Parcelle GPS →
            </Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="flex flex-col gap-3">
          <h3 className="font-medium text-stone-800">3. Localisation de la parcelle</h3>
          <label className={fieldClass}>
            Village
            <input
              className={formInputClass}
              value={form.village}
              onChange={(e) => set("village", e.target.value)}
            />
          </label>
          <label className={fieldClass}>
            Territoire
            <input
              className={formInputClass}
              value={form.territoire}
              onChange={(e) => set("territoire", e.target.value)}
            />
          </label>
          <label className={fieldClass}>
            Province
            <input
              className={formInputClass}
              value={form.province}
              onChange={(e) => set("province", e.target.value)}
            />
          </label>
          <Button size="md" className="bg-stone-600" type="button" onClick={captureGps} disabled={locating}>
            {locating ? "Localisation en cours…" : "📍 Capturer la position GPS"}
          </Button>
          {form.latitude && form.longitude && (
            <p className="text-stone-500 text-sm">
              Latitude : {form.latitude} — Longitude : {form.longitude}
            </p>
          )}
          <div className="flex gap-2">
            <Button size="md" className="bg-stone-500" onClick={() => setStep(2)}>
              ← Retour
            </Button>
            <Button size="md" onClick={handleSubmit} disabled={submitting || !form.village || !form.territoire}>
              {submitting ? "Enregistrement…" : "Enregistrer le producteur"}
            </Button>
          </div>
        </div>
      )}

      <ErrorBanner error={error} />
    </div>
  );
}
