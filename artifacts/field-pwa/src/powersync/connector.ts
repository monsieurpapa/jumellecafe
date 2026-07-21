import type { PowerSyncBackendConnector, AbstractPowerSyncDatabase, CrudEntry } from "@powersync/web";
import { fetchPowerSyncToken } from "../lib/api.js";
import { getOrCreateDeviceId } from "../lib/deviceId.js";
import { supabase } from "../lib/supabase.js";

const API_URL = import.meta.env["VITE_API_URL"] as string;

// One upload endpoint per synced table (plan §4's write flow: PowerSync's
// local CRUD queue is drained to our own Express /api/sync/* endpoints,
// not directly to Postgres/PostgREST, so server-side zod validation and
// business-rule re-checks run before data lands).
const SYNC_ENDPOINTS: Record<string, string> = {
  producteurs: "/api/sync/producteurs",
  parcelles: "/api/sync/parcelles",
  livraisons: "/api/sync/livraisons",
  inspections: "/api/sync/inspections",
  // stations intentionally absent: download-only (admin creates them online).
};

async function uploadEntry(entry: CrudEntry): Promise<void> {
  const path = SYNC_ENDPOINTS[entry.table];
  if (!path) {
    console.warn(`No sync endpoint configured for table "${entry.table}", skipping`, entry);
    return;
  }

  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Not authenticated");

  // Always POST — op is carried in the body so the server can branch on
  // insert/update/delete without relying on DELETE-with-body semantics.
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ op: entry.op, id: entry.id, data: entry.opData ?? null }),
  });
  if (!res.ok) {
    const errBody = await res.json().catch(() => null);
    throw new Error(`Sync upload failed for ${entry.table}/${entry.id}: ${res.status} ${JSON.stringify(errBody)}`);
  }
}

/**
 * Bridges PowerSync's local CRUD queue to our own Express /api/sync/*
 * endpoints. See plan §4/§5.
 */
export class ApiConnector implements PowerSyncBackendConnector {
  async fetchCredentials() {
    const deviceId = getOrCreateDeviceId();
    const { token, endpoint } = await fetchPowerSyncToken(deviceId);
    const powersyncUrl = endpoint ?? (import.meta.env["VITE_POWERSYNC_URL"] as string | undefined);
    if (!powersyncUrl) throw new Error("No PowerSync endpoint configured");
    return { endpoint: powersyncUrl, token };
  }

  async uploadData(database: AbstractPowerSyncDatabase) {
    const transaction = await database.getNextCrudTransaction();
    if (!transaction) return;

    try {
      // Sequential, in-order: later ops (e.g. a producteur's own parcelle)
      // may depend on earlier ones having landed server-side first.
      for (const entry of transaction.crud) {
        await uploadEntry(entry);
      }
      await transaction.complete();
    } catch (err) {
      // Left queued — PowerSync retries. Never dropped silently (plan §3's
      // sync_errors safety net is added when producer_code conflicts need
      // surfacing; a network/5xx failure here just retries transparently).
      console.error("Sync upload failed, will retry", err);
      throw err;
    }
  }
}
