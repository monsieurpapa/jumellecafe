import { useEffect, useState } from "react";
import { fetchDeviceBindings, revokeDeviceBinding, type DeviceBinding } from "../lib/api.js";
import { Badge, ConfirmButton, ErrorBanner, SuccessBanner, EmptyState, PageHeader, SkeletonRows } from "@jumelle/ui";

export default function DeviceBindingsList({ canWrite }: { canWrite: boolean }) {
  const [bindings, setBindings] = useState<DeviceBinding[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function load() {
    fetchDeviceBindings()
      .then(setBindings)
      .catch(setError);
  }

  useEffect(load, []);

  async function handleRevoke(binding: DeviceBinding) {
    setError(null);
    try {
      await revokeDeviceBinding(binding.id);
      setSuccess(`Appareil ${binding.deviceCode} révoqué.`);
      load();
    } catch (err) {
      setError(err);
    }
  }

  const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString("fr-FR") : "—");

  return (
    <div className="p-6">
      <PageHeader title="Appareils des agronomes" subtitle={bindings ? `${bindings.length} appareil(s)` : undefined} />
      <ErrorBanner error={error} />
      <SuccessBanner message={success} onDismiss={() => setSuccess(null)} />

      {!bindings && <SkeletonRows cols={6} />}

      {bindings && bindings.length === 0 && (
        <EmptyState
          icon="appareil"
          message="Aucun appareil enregistré pour le moment"
          description="Un agronome se voit assigner un appareil à sa première connexion depuis field-pwa."
        />
      )}

      {bindings && bindings.length > 0 && (
        <div className="overflow-x-auto border border-stone-200 shadow-sm rounded-lg bg-white">
          <table className="min-w-full text-sm border-collapse">
            <thead>
              <tr className="text-left border-b border-stone-200 bg-stone-50">
                <th className="py-2 px-4">Agronome</th>
                <th className="py-2 px-4">Code appareil</th>
                <th className="py-2 px-4">Libellé</th>
                <th className="py-2 px-4">Statut</th>
                <th className="py-2 px-4">Lié le</th>
                <th className="py-2 px-4">Dernière activité</th>
                {canWrite && <th className="py-2 px-4">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {bindings.map((b) => (
                <tr key={b.id} className="border-b border-stone-100 last:border-0 hover:bg-stone-50 transition-colors">
                  <td className="py-2 px-4">{b.agronomeNom ?? "—"}</td>
                  <td className="py-2 px-4 font-mono text-xs">{b.deviceCode}</td>
                  <td className="py-2 px-4">{b.deviceLabel ?? "—"}</td>
                  <td className="py-2 px-4">
                    <Badge variant={b.status === "active" ? "success" : "neutral"}>
                      {b.status === "active" ? "Actif" : "Révoqué"}
                    </Badge>
                  </td>
                  <td className="py-2 px-4">{fmt(b.boundAt)}</td>
                  <td className="py-2 px-4">{fmt(b.lastSeenAt)}</td>
                  {canWrite && (
                    <td className="py-2 px-4">
                      {b.status === "active" && (
                        <ConfirmButton label="Révoquer" onConfirm={() => handleRevoke(b)} />
                      )}
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
