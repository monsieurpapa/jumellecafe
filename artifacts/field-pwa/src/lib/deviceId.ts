const STORAGE_KEY = "jumelle.device_id";

/**
 * Stable per-install device identity, persisted in localStorage. A PWA
 * reinstall/storage-clear counts as "a new device" (plan §5) — that's an
 * accepted tradeoff handled by re-provisioning, not a bug.
 */
export function getOrCreateDeviceId(): string {
  let id = localStorage.getItem(STORAGE_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEY, id);
  }
  return id;
}
