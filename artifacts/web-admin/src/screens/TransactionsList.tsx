import { Fragment, useEffect, useMemo, useState } from "react";
import {
  fetchTransactions,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  type Transaction,
  type TransactionProduit,
} from "../lib/api.js";
import { Badge, Button, ConfirmButton, ErrorBanner, SuccessBanner, EmptyState, PageHeader, SkeletonRows, formInputClass } from "@jumelle/ui";

const PRODUIT_LABELS: Record<TransactionProduit, string> = {
  cerises: "Cerises",
  parche: "Parche",
  cafe_vert: "Café vert",
  cacao_fermente: "Cacao Fermenté",
  cacao_standard: "Cacao Standard",
  autre: "Autre",
};

interface FormState {
  type: "achat" | "vente";
  produit: TransactionProduit;
  contrepartie: string;
  quantiteKg: string;
  prixUnitaireCdf: string;
  dateTransaction: string;
}

const EMPTY_FORM: FormState = {
  type: "achat",
  produit: "cerises",
  contrepartie: "",
  quantiteKg: "",
  prixUnitaireCdf: "",
  dateTransaction: new Date().toISOString().slice(0, 10),
};

function toForm(t: Transaction): FormState {
  return {
    type: t.type,
    produit: t.produit,
    contrepartie: t.contrepartie,
    quantiteKg: String(t.quantiteKg),
    prixUnitaireCdf: String(t.prixUnitaireCdf),
    dateTransaction: t.dateTransaction,
  };
}

function TransactionFields({
  form,
  set,
}: {
  form: FormState;
  set: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
}) {
  return (
    <>
      <label className="text-sm">
        Type *
        <select className={formInputClass} value={form.type} onChange={(e) => set("type", e.target.value as FormState["type"])}>
          <option value="achat">Achat</option>
          <option value="vente">Vente</option>
        </select>
      </label>
      <label className="text-sm">
        Produit *
        <select
          className={formInputClass}
          value={form.produit}
          onChange={(e) => set("produit", e.target.value as TransactionProduit)}
        >
          {Object.entries(PRODUIT_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm sm:col-span-2">
        Contrepartie (producteur / acheteur) *
        <input
          className={formInputClass}
          value={form.contrepartie}
          onChange={(e) => set("contrepartie", e.target.value)}
          placeholder="ex : Producteurs membres, Exportateur Kivu Trade…"
        />
      </label>
      <label className="text-sm">
        Quantité (kg) *
        <input
          className={formInputClass}
          type="number"
          step="0.1"
          value={form.quantiteKg}
          onChange={(e) => set("quantiteKg", e.target.value)}
          placeholder="ex : 5000"
        />
      </label>
      <label className="text-sm">
        Prix unitaire (CDF/kg) *
        <input
          className={formInputClass}
          type="number"
          value={form.prixUnitaireCdf}
          onChange={(e) => set("prixUnitaireCdf", e.target.value)}
          placeholder="ex : 950"
        />
      </label>
      <label className="text-sm">
        Date
        <input
          className={formInputClass}
          type="date"
          value={form.dateTransaction}
          onChange={(e) => set("dateTransaction", e.target.value)}
        />
      </label>
    </>
  );
}

export default function TransactionsList({ canWrite }: { canWrite: boolean }) {
  const [transactions, setTransactions] = useState<Transaction[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<FormState | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function load() {
    fetchTransactions()
      .then(setTransactions)
      .catch(setError);
  }

  useEffect(load, []);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const totals = useMemo(() => {
    const rows = transactions ?? [];
    const sum = (type: "achat" | "vente", field: "quantiteKg" | "montantCdf") =>
      rows.filter((t) => t.type === type).reduce((acc, t) => acc + t[field], 0);
    return {
      achatsKg: sum("achat", "quantiteKg"),
      achatsCdf: sum("achat", "montantCdf"),
      ventesKg: sum("vente", "quantiteKg"),
      ventesCdf: sum("vente", "montantCdf"),
    };
  }, [transactions]);

  async function handleCreate() {
    setSaving(true);
    setError(null);
    try {
      await createTransaction({
        type: form.type,
        produit: form.produit,
        contrepartie: form.contrepartie.trim(),
        quantiteKg: Number(form.quantiteKg),
        prixUnitaireCdf: Number(form.prixUnitaireCdf),
        dateTransaction: form.dateTransaction,
      });
      setForm(EMPTY_FORM);
      setShowForm(false);
      setSuccess("Transaction enregistrée.");
      load();
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  }

  function startEdit(t: Transaction) {
    setShowForm(false);
    setEditingId(t.id);
    setEditForm(toForm(t));
  }

  async function handleSaveEdit(t: Transaction) {
    if (!editForm) return;
    setSavingEdit(true);
    setError(null);
    try {
      await updateTransaction(t.id, {
        type: editForm.type,
        produit: editForm.produit,
        contrepartie: editForm.contrepartie.trim(),
        quantiteKg: Number(editForm.quantiteKg),
        prixUnitaireCdf: Number(editForm.prixUnitaireCdf),
        dateTransaction: editForm.dateTransaction,
      });
      setSuccess(`Transaction « ${t.reference} » mise à jour.`);
      setEditingId(null);
      setEditForm(null);
      load();
    } catch (err) {
      setError(err);
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleDelete(t: Transaction) {
    setDeletingId(t.id);
    setError(null);
    try {
      await deleteTransaction(t.id);
      setSuccess(`Transaction « ${t.reference} » supprimée.`);
      load();
    } catch (err) {
      setError(err);
    } finally {
      setDeletingId(null);
    }
  }

  const fmt = (n: number) => n.toLocaleString("fr-FR");

  return (
    <div className="p-6">
      <PageHeader
        title="Finance — Collecte & Prix"
        subtitle={transactions ? `${transactions.length} transaction(s)` : undefined}
        action={
          canWrite && (
            <Button onClick={() => { setShowForm((v) => !v); setEditingId(null); }}>
              {showForm ? "Annuler" : "+ Nouvelle transaction"}
            </Button>
          )
        }
      />
      <ErrorBanner error={error} />
      <SuccessBanner message={success} onDismiss={() => setSuccess(null)} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-3xl mb-6">
        <div className="border border-stone-200 shadow-sm rounded-lg p-3 bg-white">
          <p className="text-xs text-stone-500">Achats (kg)</p>
          <p className="font-semibold text-stone-900">{fmt(totals.achatsKg)}</p>
        </div>
        <div className="border border-stone-200 shadow-sm rounded-lg p-3 bg-white">
          <p className="text-xs text-stone-500">Achats (CDF)</p>
          <p className="font-semibold text-stone-900">{fmt(totals.achatsCdf)}</p>
        </div>
        <div className="border border-stone-200 shadow-sm rounded-lg p-3 bg-white">
          <p className="text-xs text-stone-500">Ventes (kg)</p>
          <p className="font-semibold text-stone-900">{fmt(totals.ventesKg)}</p>
        </div>
        <div className="border border-stone-200 shadow-sm rounded-lg p-3 bg-white">
          <p className="text-xs text-stone-500">Ventes (CDF)</p>
          <p className="font-semibold text-stone-900">{fmt(totals.ventesCdf)}</p>
        </div>
      </div>

      {canWrite && showForm && (
        <div className="border border-stone-200 shadow-sm rounded-lg p-4 mb-6 grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl bg-white">
          <TransactionFields form={form} set={set} />
          <div className="sm:col-span-2">
            <Button
              size="md"
              disabled={saving || !form.contrepartie.trim() || !form.quantiteKg || !form.prixUnitaireCdf}
              onClick={handleCreate}
            >
              {saving ? "Enregistrement…" : "Enregistrer la transaction"}
            </Button>
          </div>
        </div>
      )}

      {!transactions && <SkeletonRows cols={8} />}

      {transactions && transactions.length === 0 && (
        <EmptyState icon="finance" message="Aucune transaction pour le moment" />
      )}

      {transactions && transactions.length > 0 && (
        <div className="overflow-x-auto border border-stone-200 shadow-sm rounded-lg bg-white">
          <table className="min-w-full text-sm border-collapse">
            <thead>
              <tr className="text-left border-b border-stone-200 bg-stone-50">
                <th className="py-2 px-4">Réf.</th>
                <th className="py-2 px-4">Date</th>
                <th className="py-2 px-4">Type</th>
                <th className="py-2 px-4">Produit</th>
                <th className="py-2 px-4">Contrepartie</th>
                <th className="py-2 px-4">Qté (kg)</th>
                <th className="py-2 px-4">PU (CDF/kg)</th>
                <th className="py-2 px-4">Montant (CDF)</th>
                {canWrite && <th className="py-2 px-4">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {transactions.map((t) => (
                <Fragment key={t.id}>
                  <tr className="border-b border-stone-100 last:border-0 hover:bg-stone-50 transition-colors">
                    <td className="py-2 px-4 font-mono text-xs">{t.reference}</td>
                    <td className="py-2 px-4">{t.dateTransaction}</td>
                    <td className="py-2 px-4">
                      <Badge variant={t.type === "achat" ? "neutral" : "success"}>
                        {t.type === "achat" ? "Achat" : "Vente"}
                      </Badge>
                    </td>
                    <td className="py-2 px-4">{PRODUIT_LABELS[t.produit]}</td>
                    <td className="py-2 px-4">{t.contrepartie}</td>
                    <td className="py-2 px-4">{fmt(t.quantiteKg)}</td>
                    <td className="py-2 px-4">{fmt(t.prixUnitaireCdf)}</td>
                    <td className="py-2 px-4 font-medium">{fmt(t.montantCdf)}</td>
                    {canWrite && (
                      <td className="py-2 px-4">
                        <div className="flex items-center gap-3">
                          <button
                            className="text-emerald-700 hover:text-emerald-900 underline transition-colors"
                            onClick={() => (editingId === t.id ? setEditingId(null) : startEdit(t))}
                          >
                            {editingId === t.id ? "Fermer" : "Modifier"}
                          </button>
                          <ConfirmButton
                            label="Supprimer"
                            onConfirm={() => handleDelete(t)}
                            disabled={deletingId === t.id}
                          />
                        </div>
                      </td>
                    )}
                  </tr>
                  {editingId === t.id && editForm && (
                    <tr className="border-b border-stone-100 bg-stone-50">
                      <td colSpan={9} className="p-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl">
                          <TransactionFields
                            form={editForm}
                            set={(key, value) => setEditForm({ ...editForm, [key]: value })}
                          />
                          <div className="sm:col-span-2">
                            <Button
                              size="md"
                              disabled={savingEdit || !editForm.contrepartie.trim() || !editForm.quantiteKg || !editForm.prixUnitaireCdf}
                              onClick={() => handleSaveEdit(t)}
                            >
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
