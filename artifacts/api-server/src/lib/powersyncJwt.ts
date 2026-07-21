import jwt from "jsonwebtoken";

interface PowerSyncClaims {
  sub: string; // user_id
  cooperative_id: string;
  device_id: string;
  role: string;
}

/**
 * Mints a short-lived PowerSync JWT after Express has already validated the
 * device binding — sync rules trust cooperative_id/device_id as signed
 * claims instead of re-querying device_bindings on every connection
 * (see plan §4).
 */
export function mintPowerSyncToken(claims: PowerSyncClaims): string {
  const secret = process.env["POWERSYNC_JWT_SECRET"];
  if (!secret) throw new Error("POWERSYNC_JWT_SECRET must be set");

  return jwt.sign(
    { cooperative_id: claims.cooperative_id, device_id: claims.device_id, role: claims.role },
    secret,
    { subject: claims.sub, expiresIn: "1h", audience: "powersync", issuer: "jumellecafe-api" },
  );
}
