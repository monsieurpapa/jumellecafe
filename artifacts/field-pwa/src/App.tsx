import { useEffect, useState } from "react";
import { PowerSyncContext, useStatus } from "@powersync/react";
import { Icon, type IconName } from "@jumelle/ui";
import { supabase } from "./lib/supabase.js";
import { claimDevice, fetchMe, ApiError } from "./lib/api.js";
import { getOrCreateDeviceId } from "./lib/deviceId.js";
import { setSessionCache } from "./lib/sessionCache.js";
import { connectPowerSync, powerSyncDb } from "./powersync/client.js";
import { ensureLocalCountersTable } from "./powersync/localCounters.js";
import Login from "./screens/Login.js";
import DeviceMismatch from "./screens/DeviceMismatch.js";
import ProducteurForm from "./screens/ProducteurForm.js";
import LivraisonForm from "./screens/LivraisonForm.js";
import InspectionForm from "./screens/InspectionForm.js";

type AppState = "loading" | "login" | "claiming" | "device_mismatch" | "ready" | "error";
type Screen = "producteur" | "livraison" | "inspection";

/**
 * Persistent sync status so the agronome always knows whether their last
 * submission actually reached the server — previously nothing in the UI
 * surfaced this at all.
 */
function SyncStatusBadge() {
  const status = useStatus();
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      const stats = await powerSyncDb.getUploadQueueStats();
      if (!cancelled) setPendingCount(stats.count);
    }
    void poll();
    const interval = setInterval(poll, 3000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [status.dataFlowStatus.uploading]);

  if (!status.connected) {
    return (
      <span className="text-xs text-red-600 whitespace-nowrap">
        🔴 Hors ligne{pendingCount > 0 ? ` — ${pendingCount} en attente` : ""}
      </span>
    );
  }
  if (pendingCount > 0 || status.dataFlowStatus.uploading) {
    return (
      <span className="text-xs text-amber-600 whitespace-nowrap">
        ⏳ {pendingCount || ""} en attente d'envoi
      </span>
    );
  }
  return <span className="text-xs text-emerald-700 whitespace-nowrap">✓ Synchronisé</span>;
}

export default function App() {
  const [state, setState] = useState<AppState>("loading");
  const [screen, setScreen] = useState<Screen>("producteur");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function claimAndConnect() {
    setState("claiming");
    try {
      const deviceId = getOrCreateDeviceId();
      const binding = await claimDevice(deviceId, navigator.userAgent);
      const me = await fetchMe();

      if (!me.cooperative || !me.profile.cooperativeId) {
        throw new Error("Ce compte agronome n'est rattaché à aucune coopérative.");
      }

      setSessionCache({
        cooperativeId: me.profile.cooperativeId,
        coopCode: me.cooperative.code,
        deviceCode: binding.deviceCode,
        agronomeId: me.user.id,
      });

      await connectPowerSync();
      await ensureLocalCountersTable();
      setState("ready");
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setState("device_mismatch");
        return;
      }
      setErrorMessage(err instanceof Error ? err.message : String(err));
      setState("error");
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        void claimAndConnect();
      } else {
        setState("login");
      }
    });
  }, []);

  if (state === "loading" || state === "claiming") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <p className="text-stone-500 text-sm animate-pulse">Connexion en cours…</p>
      </div>
    );
  }

  if (state === "login") {
    return <Login onSignedIn={() => void claimAndConnect()} />;
  }

  if (state === "device_mismatch") {
    return <DeviceMismatch />;
  }

  if (state === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 bg-stone-50">
        <p className="text-red-700 bg-red-50 border border-red-200 rounded-md px-4 py-3 text-center">
          {errorMessage}
        </p>
      </div>
    );
  }

  const TABS: { key: Screen; label: string; icon: IconName }[] = [
    { key: "producteur", label: "Producteur", icon: "producteur" },
    { key: "livraison", label: "Livraison", icon: "livraison" },
    { key: "inspection", label: "Inspection", icon: "inspection" },
  ];

  const tabClass = (active: boolean) =>
    `flex-1 flex items-center justify-center gap-1.5 py-3 text-sm border-b-[3px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-[-2px] ${
      active ? "border-emerald-700 font-semibold text-emerald-800" : "border-transparent text-stone-500"
    }`;

  return (
    <PowerSyncContext.Provider value={powerSyncDb}>
      <div className="min-h-screen bg-stone-50">
        <nav className="flex items-center border-b border-stone-200 bg-white">
          {TABS.map((tab) => (
            <button key={tab.key} className={tabClass(screen === tab.key)} onClick={() => setScreen(tab.key)}>
              <Icon name={tab.icon} size={16} />
              {tab.label}
            </button>
          ))}
          <div className="px-3">
            <SyncStatusBadge />
          </div>
        </nav>
        {screen === "producteur" && <ProducteurForm />}
        {screen === "livraison" && <LivraisonForm />}
        {screen === "inspection" && <InspectionForm />}
      </div>
    </PowerSyncContext.Provider>
  );
}
