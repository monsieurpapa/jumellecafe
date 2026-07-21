const STORAGE_KEY = "jumelle.session_cache";

export interface SessionCache {
  cooperativeId: string;
  coopCode: string;
  deviceCode: string;
  agronomeId: string;
}

/**
 * Cached at login time (GET /api/me + the device-binding claim response)
 * so the producer-code algorithm can run fully offline afterward — it
 * never needs a network round-trip once cached (plan §3).
 */
export function setSessionCache(cache: SessionCache): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
}

export function getSessionCache(): SessionCache | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SessionCache;
  } catch {
    return null;
  }
}
