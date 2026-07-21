import { supabase } from "./supabase.js";

const API_URL = import.meta.env["VITE_API_URL"] as string;

export class ApiError extends Error {
  constructor(
    public status: number,
    public body: unknown,
  ) {
    super(`API error ${status}`);
  }
}

async function authedFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Not authenticated");

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { ...options.headers, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, body);
  return body as T;
}

export interface DeviceBinding {
  id: string;
  userId: string;
  cooperativeId: string;
  deviceId: string;
  deviceCode: string;
  status: "active" | "revoked";
}

export function claimDevice(deviceId: string, deviceLabel?: string): Promise<DeviceBinding> {
  return authedFetch("/api/device-bindings/claim", {
    method: "POST",
    body: JSON.stringify({ deviceId, deviceLabel }),
  });
}

export function fetchPowerSyncToken(deviceId: string): Promise<{ token: string; endpoint: string | null }> {
  return authedFetch("/api/powersync/token", {
    method: "POST",
    body: JSON.stringify({ deviceId }),
  });
}

export interface MeResponse {
  user: { id: string; email: string };
  profile: { userId: string; cooperativeId: string | null; role: string };
  cooperative: { id: string; code: string; nom: string } | null;
}

export function fetchMe(): Promise<MeResponse> {
  return authedFetch("/api/me", { method: "GET" });
}
