import { useEffect, useMemo, useState } from "react";
import {
  fetchTransactions,
  createTransaction,
  type Transaction,
  type TransactionProduit,
} from "../lib/api.js";
import { Button, ErrorBanner, SuccessBanner, EmptyState, formInputClass } from "@jumelle/ui";

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

export default function TransactionsList({ canWrite }: { canWrite: boolean }) {
  const [transactions, setTransactions] = useState<Transaction[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

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

  const fmt = (n: number) => n.toLocaleString("fr-FR");

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-xl font-semibold">Finance — Collecte &amp; Prix</h1>
        {canWrite && (
          <Button onClick={() => setShowForm((v) => !v)}>{showForm ? "Annuler" : "+ Nouvelle transaction"}</Button>
        )}
      </div>
      <p className="text-neutral-500 mb-4">
        {transactions ? `${transactions.length} transaction(s)` : "Chargement…"}
      </p>
      <ErrorBanner error={error} />
      <SuccessBanner message={success} onDismiss={() => setSuccess(null)} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-3xl mb-6">
        <div className="border rounded p-3">
          <p className="text-xs text-neutral-500">Achats (kg)</p>
          <p className="font-semibold">{fmt(totals.achatsKg)}</p>
        </div>
        <div className="border rounded p-3">
          <p className="text-xs text-neutral-500">Achats (CDF)</p>
          <p className="font-semibold">{fmt(totals.achatsCdf)}</p>
        </div>
        <div className="border rounded p-3">
          <p className="text-xs text-neutral-500">Ventes (kg)</p>
          <p className="font-semibold">{fmt(totals.ventesKg)}</p>
        </div>
        <div className="border rounded p-3">
          <p className="text-xs text-neutral-500">Ventes (CDF)</p>
          <p className="font-semibold">{fmt(totals.ventesCdf)}</p>
        </div>
      </div>

      {canWrite && showForm && (
        <div className="border rounded p-4 mb-6 grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl">
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

      {transactions && transactions.length === 0 && <EmptyState message="Aucune transaction pour le moment." />}

      {transactions && transactions.length > 0 && (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm border-collapse">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2 pr-4">Réf.</th>
                <th className="py-2 pr-4">Date</th>
                <th className="py-2 pr-4">Type</th>
                <th className="py-2 pr-4">Produit</th>
                <th className="py-2 pr-4">Contrepartie</th>
                <th className="py-2 pr-4">Qté (kg)</th>
                <th className="py-2 pr-4">PU (CDF/kg)</th>
                <th className="py-2 pr-4">Montant (CDF)</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((t) => (
                <tr key={t.id} className="border-b">
                  <td className="py-2 pr-4 font-mono text-xs">{t.reference}</td>
                  <td className="py-2 pr-4">{t.dateTransaction}</td>
                  <td className="py-2 pr-4">{t.type === "achat" ? "Achat" : "Vente"}</td>
                  <td className="py-2 pr-4">{PRODUIT_LABELS[t.produit]}</td>
                  <td className="py-2 pr-4">{t.contrepartie}</td>
                  <td className="py-2 pr-4">{fmt(t.quantiteKg)}</td>
                  <td className="py-2 pr-4">{fmt(t.prixUnitaireCdf)}</td>
                  <td className="py-2 pr-4 font-medium">{fmt(t.montantCdf)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
