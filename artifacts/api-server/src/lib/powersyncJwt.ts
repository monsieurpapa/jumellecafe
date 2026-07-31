import jwt from "jsonwebtoken";

interface PowerSyncClaims {
  sub: string; // user_id
  cooperative_id: string;
  device_id: string;
  role: string;
}

// Matches the KID registered under the PowerSync Cloud instance's Client
// Auth > HS256 authentication tokens config — PowerSync selects the
// verification key by this header, so it must stay in sync with the
// dashboard entry.
const KEY_ID = "jumellecafe-api";

/**
 * Mints a short-lived PowerSync JWT after Express has already validated the
 * device binding — sync rules trust cooperative_id/device_id as signed
 * claims instead of re-querying device_bindings on every connection
 * (see plan §4).
 *
 * POWERSYNC_JWT_SECRET is base64url text (PowerSync Cloud's "Secret
 * (base64url encoded)" field expects the encoded form and decodes it to raw
 * key bytes) — decode here too so both sides sign/verify with the same
 * underlying HMAC key rather than the literal secret string's UTF-8 bytes.
 */
export function mintPowerSyncToken(claims: PowerSyncClaims): string {
  const secret = process.env["POWERSYNC_JWT_SECRET"];
  if (!secret) throw new Error("POWERSYNC_JWT_SECRET must be set");

  return jwt.sign(
    { cooperative_id: claims.cooperative_id, device_id: claims.device_id, role: claims.role },
    Buffer.from(secret, "base64url"),
    { subject: claims.sub, expiresIn: "1h", audience: "powersync", issuer: "jumellecafe-api", keyid: KEY_ID },
  );
}
