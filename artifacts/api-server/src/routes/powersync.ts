import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import { db, deviceBindingsTable } from "@jumelle/db";
import { requireAuth, requireRole } from "../middlewares/auth.js";
import { mintPowerSyncToken } from "../lib/powersyncJwt.js";

const router: IRouter = Router();

/**
 * POST /api/powersync/token — re-validates the device binding, then mints
 * a short-lived PowerSync JWT embedding cooperative_id/device_id as signed
 * claims for the sync-rule bucket definitions to trust. See plan §4/§5.
 * The PWA must call /api/device-bindings/claim successfully first.
 */
router.post("/powersync/token", requireAuth, requireRole("agronome"), async (req, res) => {
  const { deviceId } = req.body as { deviceId?: string };
  if (!deviceId) {
    res.status(400).json({ error: "deviceId is required" });
    return;
  }

  const [active] = await db
    .select()
    .from(deviceBindingsTable)
    .where(and(eq(deviceBindingsTable.userId, req.profile!.userId), eq(deviceBindingsTable.status, "active")));

  if (!active || active.deviceId !== deviceId) {
    res.status(403).json({ error: "device_mismatch" });
    return;
  }

  await db
    .update(deviceBindingsTable)
    .set({ lastSeenAt: new Date() })
    .where(eq(deviceBindingsTable.id, active.id));

  const token = mintPowerSyncToken({
    sub: req.profile!.userId,
    cooperative_id: active.cooperativeId,
    device_id: active.deviceId,
    role: req.profile!.role,
  });

  res.json({ token, endpoint: process.env["POWERSYNC_URL"] ?? null });
});

export default router;
