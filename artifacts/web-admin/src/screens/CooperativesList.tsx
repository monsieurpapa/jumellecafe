import { useEffect, useState } from "react";
import { fetchCooperatives, createCooperative, type Cooperative, type CreateCooperativeInput } from "../lib/api.js";
import { Button, ErrorBanner, SuccessBanner, EmptyState, formInputClass } from "@jumelle/ui";

interface FormState {
  code: string;
  nom: string;
  province: string;
  territoire: string;
  contactEmail: string;
  contactPhone: string;
  eudrBaselineUploaded: boolean;
  adminEmail: string;
  adminNomComplet: string;
}

const EMPTY_FORM: FormState = {
  code: "",
  nom: "",
  province: "Sud-Kivu",
  territoire: "",
  contactEmail: "",
  contactPhone: "",
  eudrBaselineUploaded: false,
  adminEmail: "",
  adminNomComplet: "",
};

const ERROR_MESSAGES: Record<string, string> = {
  "A cooperative with this code already exists": "Ce code coopérative existe déjà.",
  "This user already has a profile on the platform": "Cet e-mail administrateur a déjà un profil sur la plateforme.",
  "adminEmail is required": "L'e-mail de l'administrateur est requis.",
};

export default function CooperativesList() {
  const [cooperatives, setCooperatives] = useState<Cooperative[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  function load() {
    fetchCooperatives()
      .then(setCooperatives)
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
      const input: CreateCooperativeInput = {
        code: form.code.trim(),
        nom: form.nom.trim(),
        province: form.province.trim() || undefined,
        territoire: form.territoire.trim() || undefined,
        contactEmail: form.contactEmail.trim() || undefined,
        contactPhone: form.contactPhone.trim() || undefined,
        eudrBaselineUploaded: form.eudrBaselineUploaded,
        adminEmail: form.adminEmail.trim(),
        adminNomComplet: form.adminNomComplet.trim() || undefined,
      };
      await createCooperative(input);
      setForm(EMPTY_FORM);
      setShowForm(false);
      setSuccess(`Coopérative « ${input.nom} » créée.`);
      load();
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-xl font-semibold">Coopératives</h1>
        <Button onClick={() => setShowForm((v) => !v)}>{showForm ? "Annuler" : "+ Nouvelle coopérative"}</Button>
      </div>
      <p className="text-neutral-500 mb-4">
        {cooperatives ? `${cooperatives.length} coopérative(s)` : "Chargement…"}
      </p>
      <ErrorBanner error={error} messages={ERROR_MESSAGES} />
      <SuccessBanner message={success} onDismiss={() => setSuccess(null)} />

      {showForm && (
        <div className="border rounded p-4 mb-6 grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl">
          <label className="text-sm">
            Code *
            <input className={formInputClass} value={form.code} onChange={(e) => set("code", e.target.value)} placeholder="COOP-GOMA" />
          </label>
          <label className="text-sm">
            Nom *
            <input className={formInputClass} value={form.nom} onChange={(e) => set("nom", e.target.value)} placeholder="Coopérative des Producteurs de Goma" />
          </label>
          <label className="text-sm">
            Province
            <input className={formInputClass} value={form.province} onChange={(e) => set("province", e.target.value)} />
          </label>
          <label className="text-sm">
            Territoire
            <input className={formInputClass} value={form.territoire} onChange={(e) => set("territoire", e.target.value)} />
          </label>
          <label className="text-sm">
            E-mail de contact
            <input className={formInputClass} type="email" value={form.contactEmail} onChange={(e) => set("contactEmail", e.target.value)} />
          </label>
          <label className="text-sm">
            Téléphone de contact
            <input className={formInputClass} value={form.contactPhone} onChange={(e) => set("contactPhone", e.target.value)} />
          </label>
          <label className="text-sm flex items-center gap-2 mt-5">
            <input
              type="checkbox"
              checked={form.eudrBaselineUploaded}
              onChange={(e) => set("eudrBaselineUploaded", e.target.checked)}
            />
            Baseline EUDR déjà téléversée
          </label>
          <div className="sm:col-span-2 border-t pt-3 mt-1">
            <p className="text-sm font-medium mb-2">Premier administrateur de la coopérative</p>
          </div>
          <label className="text-sm">
            E-mail administrateur *
            <input
              className={formInputClass}
              type="email"
              value={form.adminEmail}
              onChange={(e) => set("adminEmail", e.target.value)}
              placeholder="admin@cooperative.cd"
            />
          </label>
          <label className="text-sm">
            Nom complet administrateur
            <input className={formInputClass} value={form.adminNomComplet} onChange={(e) => set("adminNomComplet", e.target.value)} />
          </label>
          <div className="sm:col-span-2">
            <Button
              size="md"
              disabled={saving || !form.code.trim() || !form.nom.trim() || !form.adminEmail.trim()}
              onClick={handleCreate}
            >
              {saving ? "Enregistrement…" : "Créer la coopérative"}
            </Button>
          </div>
        </div>
      )}

      {cooperatives && cooperatives.length === 0 && (
        <EmptyState message="Aucune coopérative pour le moment." />
      )}

      {cooperatives && cooperatives.length > 0 && (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm border-collapse">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2 pr-4">Code</th>
                <th className="py-2 pr-4">Nom</th>
                <th className="py-2 pr-4">Province</th>
                <th className="py-2 pr-4">Territoire</th>
                <th className="py-2 pr-4">Contact</th>
                <th className="py-2 pr-4">Baseline EUDR</th>
              </tr>
            </thead>
            <tbody>
              {cooperatives.map((c) => (
                <tr key={c.id} className="border-b">
                  <td className="py-2 pr-4 font-mono text-xs">{c.code}</td>
                  <td className="py-2 pr-4">{c.nom}</td>
                  <td className="py-2 pr-4">{c.province}</td>
                  <td className="py-2 pr-4">{c.territoire ?? "—"}</td>
                  <td className="py-2 pr-4">{c.contactEmail ?? c.contactPhone ?? "—"}</td>
                  <td className="py-2 pr-4">
                    {c.eudrBaselineUploaded ? (
                      <span className="text-emerald-700">✔ Téléversée</span>
                    ) : (
                      <span className="text-neutral-500">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
