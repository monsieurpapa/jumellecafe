import { useEffect, useRef, useState } from "react";
import { fetchDeviceBindings, revokeDeviceBinding, type DeviceBinding } from "../lib/api.js";
import { ErrorBanner, SuccessBanner, EmptyState } from "@jumelle/ui";

const CONFIRM_TIMEOUT_MS = 4000;

export default function DeviceBindingsList({ canWrite }: { canWrite: boolean }) {
  const [bindings, setBindings] = useState<DeviceBinding[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const confirmTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  function load() {
    fetchDeviceBindings()
      .then(setBindings)
      .catch(setError);
  }

  useEffect(load, []);
  useEffect(() => () => {
    if (confirmTimeout.current) clearTimeout(confirmTimeout.current);
  }, []);

  function askConfirm(id: string) {
    setConfirmingId(id);
    if (confirmTimeout.current) clearTimeout(confirmTimeout.current);
    confirmTimeout.current = setTimeout(() => setConfirmingId(null), CONFIRM_TIMEOUT_MS);
  }

  async function handleRevoke(binding: DeviceBinding) {
    if (confirmTimeout.current) clearTimeout(confirmTimeout.current);
    setConfirmingId(null);
    setRevokingId(binding.id);
    setError(null);
    try {
      await revokeDeviceBinding(binding.id);
      setSuccess(`Appareil ${binding.deviceCode} révoqué.`);
      load();
    } catch (err) {
      setError(err);
    } finally {
      setRevokingId(null);
    }
  }

  const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString("fr-FR") : "—");

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold mb-1">Appareils des agronomes</h1>
      <p className="text-neutral-500 mb-4">
        {bindings ? `${bindings.length} appareil(s)` : "Chargement…"}
      </p>
      <ErrorBanner error={error} />
      <SuccessBanner message={success} onDismiss={() => setSuccess(null)} />

      {bindings && bindings.length === 0 && (
        <EmptyState message="Aucun appareil enregistré pour le moment." />
      )}

      {bindings && bindings.length > 0 && (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm border-collapse">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2 pr-4">Agronome</th>
                <th className="py-2 pr-4">Code appareil</th>
                <th className="py-2 pr-4">Libellé</th>
                <th className="py-2 pr-4">Statut</th>
                <th className="py-2 pr-4">Lié le</th>
                <th className="py-2 pr-4">Dernière activité</th>
                {canWrite && <th className="py-2 pr-4">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {bindings.map((b) => (
                <tr key={b.id} className="border-b">
                  <td className="py-2 pr-4">{b.agronomeNom ?? "—"}</td>
                  <td className="py-2 pr-4 font-mono text-xs">{b.deviceCode}</td>
                  <td className="py-2 pr-4">{b.deviceLabel ?? "—"}</td>
                  <td className="py-2 pr-4">
                    {b.status === "active" ? (
                      <span className="text-emerald-700">Actif</span>
                    ) : (
                      <span className="text-neutral-500">Révoqué</span>
                    )}
                  </td>
                  <td className="py-2 pr-4">{fmt(b.boundAt)}</td>
                  <td className="py-2 pr-4">{fmt(b.lastSeenAt)}</td>
                  {canWrite && (
                    <td className="py-2 pr-4">
                      {b.status === "active" &&
                        (confirmingId === b.id ? (
                          <span className="inline-flex items-center gap-2">
                            <button
                              className="text-red-600 underline disabled:opacity-50"
                              disabled={revokingId === b.id}
                              onClick={() => handleRevoke(b)}
                            >
                              {revokingId === b.id ? "Révocation…" : "Confirmer ?"}
                            </button>
                            <button className="text-neutral-500 underline" onClick={() => setConfirmingId(null)}>
                              Annuler
                            </button>
                          </span>
                        ) : (
                          <button className="text-neutral-600 underline" onClick={() => askConfirm(b.id)}>
                            Révoquer
                          </button>
                        ))}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
