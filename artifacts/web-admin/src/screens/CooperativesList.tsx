import { Fragment, useEffect, useState } from "react";
import {
  fetchCooperatives,
  createCooperative,
  updateCooperative,
  type Cooperative,
  type CreateCooperativeInput,
} from "../lib/api.js";
import { Badge, Button, ConfirmButton, ErrorBanner, SuccessBanner, EmptyState, PageHeader, SkeletonRows, formInputClass } from "@jumelle/ui";

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

interface EditFormState {
  nom: string;
  province: string;
  territoire: string;
  contactEmail: string;
  contactPhone: string;
  eudrBaselineUploaded: boolean;
}

export default function CooperativesList() {
  const [cooperatives, setCooperatives] = useState<Cooperative[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditFormState | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [togglingActifId, setTogglingActifId] = useState<string | null>(null);

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

  function startEdit(c: Cooperative) {
    setShowForm(false);
    setEditingId(c.id);
    setEditForm({
      nom: c.nom,
      province: c.province,
      territoire: c.territoire ?? "",
      contactEmail: c.contactEmail ?? "",
      contactPhone: c.contactPhone ?? "",
      eudrBaselineUploaded: c.eudrBaselineUploaded,
    });
  }

  async function handleSaveEdit(c: Cooperative) {
    if (!editForm) return;
    setSavingEdit(true);
    setError(null);
    try {
      await updateCooperative(c.id, {
        nom: editForm.nom.trim(),
        province: editForm.province.trim(),
        territoire: editForm.territoire.trim() || null,
        contactEmail: editForm.contactEmail.trim() || null,
        contactPhone: editForm.contactPhone.trim() || null,
        eudrBaselineUploaded: editForm.eudrBaselineUploaded,
      });
      setSuccess(`Coopérative « ${editForm.nom} » mise à jour.`);
      setEditingId(null);
      setEditForm(null);
      load();
    } catch (err) {
      setError(err);
    } finally {
      setSavingEdit(false);
    }
  }

  async function toggleActif(c: Cooperative) {
    setTogglingActifId(c.id);
    setError(null);
    try {
      await updateCooperative(c.id, { actif: !c.actif });
      setSuccess(`Coopérative « ${c.nom} » ${c.actif ? "désactivée" : "réactivée"}.`);
      load();
    } catch (err) {
      setError(err);
    } finally {
      setTogglingActifId(null);
    }
  }

  return (
    <div className="p-6">
      <PageHeader
        title="Coopératives"
        subtitle={cooperatives ? `${cooperatives.length} coopérative(s)` : undefined}
        action={<Button onClick={() => { setShowForm((v) => !v); setEditingId(null); }}>{showForm ? "Annuler" : "+ Nouvelle coopérative"}</Button>}
      />
      <ErrorBanner error={error} messages={ERROR_MESSAGES} />
      <SuccessBanner message={success} onDismiss={() => setSuccess(null)} />

      {showForm && (
        <div className="border border-stone-200 shadow-sm rounded-lg p-4 mb-6 grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl bg-white">
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
          <div className="sm:col-span-2 border-t border-stone-200 pt-3 mt-1">
            <p className="text-sm font-medium mb-2 text-stone-700">Premier administrateur de la coopérative</p>
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

      {!cooperatives && <SkeletonRows cols={6} />}

      {cooperatives && cooperatives.length === 0 && (
        <EmptyState icon="cooperative" message="Aucune coopérative pour le moment" />
      )}

      {cooperatives && cooperatives.length > 0 && (
        <div className="overflow-x-auto border border-stone-200 shadow-sm rounded-lg bg-white">
          <table className="min-w-full text-sm border-collapse">
            <thead>
              <tr className="text-left border-b border-stone-200 bg-stone-50">
                <th className="py-2 px-4">Code</th>
                <th className="py-2 px-4">Nom</th>
                <th className="py-2 px-4">Province</th>
                <th className="py-2 px-4">Territoire</th>
                <th className="py-2 px-4">Contact</th>
                <th className="py-2 px-4">Baseline EUDR</th>
                <th className="py-2 px-4">Statut</th>
                <th className="py-2 px-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {cooperatives.map((c) => (
                <Fragment key={c.id}>
                  <tr className="border-b border-stone-100 last:border-0 hover:bg-stone-50 transition-colors">
                    <td className="py-2 px-4 font-mono text-xs">{c.code}</td>
                    <td className="py-2 px-4">{c.nom}</td>
                    <td className="py-2 px-4">{c.province}</td>
                    <td className="py-2 px-4">{c.territoire ?? "—"}</td>
                    <td className="py-2 px-4">{c.contactEmail ?? c.contactPhone ?? "—"}</td>
                    <td className="py-2 px-4">
                      {c.eudrBaselineUploaded ? (
                        <Badge variant="success">✔ Téléversée</Badge>
                      ) : (
                        <span className="text-stone-400">—</span>
                      )}
                    </td>
                    <td className="py-2 px-4">
                      <Badge variant={c.actif ? "success" : "neutral"}>{c.actif ? "Active" : "Désactivée"}</Badge>
                    </td>
                    <td className="py-2 px-4">
                      <div className="flex items-center gap-3">
                        <button
                          className="text-emerald-700 hover:text-emerald-900 underline transition-colors"
                          onClick={() => (editingId === c.id ? setEditingId(null) : startEdit(c))}
                        >
                          {editingId === c.id ? "Fermer" : "Modifier"}
                        </button>
                        <ConfirmButton
                          label={c.actif ? "Désactiver" : "Réactiver"}
                          onConfirm={() => toggleActif(c)}
                          disabled={togglingActifId === c.id}
                        />
                      </div>
                    </td>
                  </tr>
                  {editingId === c.id && editForm && (
                    <tr className="border-b border-stone-100 bg-stone-50">
                      <td colSpan={8} className="p-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl">
                          <label className="text-sm">
                            Nom
                            <input
                              className={formInputClass}
                              value={editForm.nom}
                              onChange={(e) => setEditForm({ ...editForm, nom: e.target.value })}
                            />
                          </label>
                          <label className="text-sm">
                            Province
                            <input
                              className={formInputClass}
                              value={editForm.province}
                              onChange={(e) => setEditForm({ ...editForm, province: e.target.value })}
                            />
                          </label>
                          <label className="text-sm">
                            Territoire
                            <input
                              className={formInputClass}
                              value={editForm.territoire}
                              onChange={(e) => setEditForm({ ...editForm, territoire: e.target.value })}
                            />
                          </label>
                          <label className="text-sm">
                            E-mail de contact
                            <input
                              className={formInputClass}
                              type="email"
                              value={editForm.contactEmail}
                              onChange={(e) => setEditForm({ ...editForm, contactEmail: e.target.value })}
                            />
                          </label>
                          <label className="text-sm">
                            Téléphone de contact
                            <input
                              className={formInputClass}
                              value={editForm.contactPhone}
                              onChange={(e) => setEditForm({ ...editForm, contactPhone: e.target.value })}
                            />
                          </label>
                          <label className="text-sm flex items-center gap-2 mt-5">
                            <input
                              type="checkbox"
                              checked={editForm.eudrBaselineUploaded}
                              onChange={(e) => setEditForm({ ...editForm, eudrBaselineUploaded: e.target.checked })}
                            />
                            Baseline EUDR déjà téléversée
                          </label>
                          <div className="sm:col-span-2">
                            <Button size="md" disabled={savingEdit || !editForm.nom.trim()} onClick={() => handleSaveEdit(c)}>
                              {savingEdit ? "Enregistrement…" : "Enregistrer les modifications"}
                            </Button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
