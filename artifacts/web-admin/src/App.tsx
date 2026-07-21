import { useEffect, useState } from "react";
import { supabase } from "./lib/supabase.js";
import { fetchMe, fetchCooperatives, setActiveCooperativeId, type MeResponse, type Cooperative } from "./lib/api.js";
import Login from "./screens/Login.js";
import Dashboard from "./screens/Dashboard.js";
import ProducteursList from "./screens/ProducteursList.js";
import ParcellesMap from "./screens/ParcellesMap.js";
import StationsList from "./screens/StationsList.js";
import LivraisonsList from "./screens/LivraisonsList.js";
import LotsList from "./screens/LotsList.js";
import InspectionsList from "./screens/InspectionsList.js";
import TransactionsList from "./screens/TransactionsList.js";
import CooperativesList from "./screens/CooperativesList.js";
import DeviceBindingsList from "./screens/DeviceBindingsList.js";

type AppState = "loading" | "login" | "ready";
type Screen =
  | "dashboard"
  | "producteurs"
  | "parcelles"
  | "stations"
  | "livraisons"
  | "lots"
  | "inspections"
  | "finance"
  | "cooperatives"
  | "appareils";

const NAV: { key: Screen; label: string }[] = [
  { key: "dashboard", label: "Tableau de bord" },
  { key: "producteurs", label: "Producteurs" },
  { key: "parcelles", label: "Parcelles GPS" },
  { key: "stations", label: "Stations" },
  { key: "livraisons", label: "Livraisons" },
  { key: "lots", label: "Traçabilité" },
  { key: "inspections", label: "Audit Interne" },
  { key: "finance", label: "Finance" },
  { key: "appareils", label: "Appareils" },
  { key: "cooperatives", label: "Coopératives" },
];

export default function App() {
  const [state, setState] = useState<AppState>("loading");
  const [screen, setScreen] = useState<Screen>("dashboard");
  const [me, setMe] = useState<MeResponse | null>(null);
  const [cooperatives, setCooperatives] = useState<Cooperative[] | null>(null);
  const [activeCooperativeId, setActiveCooperativeIdState] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setState(data.session ? "ready" : "login");
    });
  }, []);

  // Loads the caller's role/cooperative once per session, and (Super Admin
  // only, who has no home cooperative) the full cooperative list for the
  // scope picker below.
  useEffect(() => {
    if (state !== "ready" || me) return;
    fetchMe()
      .then((m) => {
        setMe(m);
        if (m.profile.role === "super_admin") {
          fetchCooperatives()
            .then(setCooperatives)
            .catch(() => setCooperatives([]));
        }
      })
      .catch(() => {
        // Leave me null — screens will still work for roles the server
        // recognizes; anything scoped will simply 403/400 as before.
      });
  }, [state, me]);

  useEffect(() => {
    setActiveCooperativeId(activeCooperativeId);
  }, [activeCooperativeId]);

  if (state === "loading" || (state === "ready" && !me)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50">
        <p className="text-neutral-500">Chargement…</p>
      </div>
    );
  }

  if (state === "login" || !me) {
    return <Login onSignedIn={() => setState("ready")} />;
  }

  const isSuperAdmin = me.profile.role === "super_admin";
  const canWrite = me.profile.role === "admin_cooperative";
  const visibleNav = NAV.filter((item) => {
    if (item.key === "cooperatives") return isSuperAdmin;
    if (item.key === "appareils") return isSuperAdmin || canWrite;
    return true;
  });
  const needsCooperativePick = isSuperAdmin && !activeCooperativeId && screen !== "cooperatives";

  return (
    <div>
      <nav className="flex items-center justify-between gap-2 border-b bg-white px-4">
        <div className="flex gap-1">
          {visibleNav.map((item) => (
            <button
              key={item.key}
              className={`px-3 py-2 text-sm border-b-2 ${
                screen === item.key
                  ? "border-emerald-700 font-semibold text-emerald-800"
                  : "border-transparent text-neutral-600"
              }`}
              onClick={() => setScreen(item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>
        {isSuperAdmin && (
          <label className="text-sm text-neutral-600 py-2">
            Coopérative :{" "}
            <select
              className="border rounded px-2 py-1 text-sm"
              value={activeCooperativeId ?? ""}
              onChange={(e) => setActiveCooperativeIdState(e.target.value || null)}
            >
              <option value="">— Sélectionner —</option>
              {(cooperatives ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nom} ({c.code})
                </option>
              ))}
            </select>
          </label>
        )}
      </nav>
      {needsCooperativePick ? (
        <div className="p-6">
          <p className="text-neutral-500">Sélectionnez une coopérative ci-dessus pour continuer.</p>
        </div>
      ) : (
        <>
          {screen === "dashboard" && <Dashboard />}
          {screen === "producteurs" && <ProducteursList />}
          {screen === "parcelles" && <ParcellesMap />}
          {screen === "stations" && <StationsList canWrite={canWrite} />}
          {screen === "livraisons" && <LivraisonsList />}
          {screen === "lots" && <LotsList canWrite={canWrite} />}
          {screen === "inspections" && <InspectionsList />}
          {screen === "finance" && <TransactionsList canWrite={canWrite} />}
          {screen === "appareils" && <DeviceBindingsList canWrite={canWrite} />}
          {screen === "cooperatives" && <CooperativesList />}
        </>
      )}
    </div>
  );
}
