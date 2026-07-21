import { powerSyncDb } from "./client.js";

/**
 * Local-only bookkeeping table (not part of appSchema, never synced) for
 * the producer-code sequence. Atomic against double-submits on the SAME
 * device only — it never needs cross-device coordination, because
 * device_code (server-assigned, unique per cooperative) already
 * disambiguates concurrent offline registrations from other agronomes
 * (plan §3).
 */
export async function ensureLocalCountersTable(): Promise<void> {
  await powerSyncDb.execute(
    "CREATE TABLE IF NOT EXISTS local_counters (key TEXT PRIMARY KEY, value INTEGER NOT NULL)",
  );
}

export function nextLocalSequence(deviceCode: string): Promise<number> {
  return nextSequenceForKey(`producer_seq:${deviceCode}`);
}

/** Separate counter for bons de livraison — same single-device atomicity contract. */
export function nextBonSequence(deviceCode: string): Promise<number> {
  return nextSequenceForKey(`bon_seq:${deviceCode}`);
}

async function nextSequenceForKey(key: string): Promise<number> {
  return powerSyncDb.writeTransaction(async (tx) => {
    const row = await tx.getOptional<{ value: number }>("SELECT value FROM local_counters WHERE key = ?", [key]);
    const next = (row?.value ?? 0) + 1;
    await tx.execute("INSERT INTO local_counters (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?", [
      key,
      next,
      next,
    ]);
    return next;
  });
}
