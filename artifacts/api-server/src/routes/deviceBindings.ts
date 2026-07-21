import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import { db, deviceBindingsTable, userProfilesTable } from "@jumelle/db";
import { requireAuth, requireRole } from "../middlewares/auth.js";

const router: IRouter = Router();

async function nextDeviceCode(cooperativeId: string): Promise<string> {
  const existing = await db
    .select({ deviceCode: deviceBindingsTable.deviceCode })
    .from(deviceBindingsTable)
    .where(eq(deviceBindingsTable.cooperativeId, cooperativeId));
  return `D${String(existing.length + 1).padStart(2, "0")}`;
}

/**
 * GET /api/device-bindings — Admin Coopérative / Super Admin view of every
 * agronome device binding for the cooperative, so a lost/replaced phone can
 * be revoked without a direct DB edit. Super Admin passes ?cooperativeId=
 * explicitly, same rule as elsewhere (plan §5).
 */
router.get(
  "/device-bindings",
  requireAuth,
  requireRole("admin_cooperative", "super_admin"),
  async (req, res) => {
    const cooperativeId = req.profile!.cooperativeId ?? (req.query["cooperativeId"] as string | undefined);
    if (!cooperativeId) {
      res.status(400).json({ error: "cooperativeId is required" });
      return;
    }
    const rows = await db
      .select({ binding: deviceBindingsTable, agronomeNom: userProfilesTable.nomComplet })
      .from(deviceBindingsTable)
      .innerJoin(userProfilesTable, eq(userProfilesTable.userId, deviceBindingsTable.userId))
      .where(eq(deviceBindingsTable.cooperativeId, cooperativeId));
    res.json(rows.map((r) => ({ ...r.binding, agronomeNom: r.agronomeNom })));
  },
);

/**
 * PATCH /api/device-bindings/:id/revoke — frees up a binding so the
 * agronome can claim a new device (see the unique "one active binding per
 * user" index this relies on being freed).
 */
router.patch(
  "/device-bindings/:id/revoke",
  requireAuth,
  requireRole("admin_cooperative"),
  async (req, res) => {
    const bindingId = String(req.params["id"]);
    const [existing] = await db
      .select()
      .from(deviceBindingsTable)
      .where(and(eq(deviceBindingsTable.id, bindingId), eq(deviceBindingsTable.cooperativeId, req.profile!.cooperativeId!)));
    if (!existing) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    if (existing.status === "revoked") {
      res.status(409).json({ error: "already_revoked" });
      return;
    }
    const [updated] = await db
      .update(deviceBindingsTable)
      .set({ status: "revoked", revokedAt: new Date(), revokedBy: req.profile!.userId })
      .where(eq(deviceBindingsTable.id, bindingId))
      .returning();
    res.status(200).json(updated);
  },
);

/**
 * POST /api/device-bindings/claim — first-claim binds a device to the
 * agronome and server-assigns a device_code; a matching repeat claim just
 * refreshes last_seen_at; a mismatched device is rejected. See plan §5.
 */
router.post("/device-bindings/claim", requireAuth, requireRole("agronome"), async (req, res) => {
  const { deviceId, deviceLabel } = req.body as { deviceId?: string; deviceLabel?: string };
  if (!deviceId) {
    res.status(400).json({ error: "deviceId is required" });
    return;
  }
  const cooperativeId = req.profile!.cooperativeId;
  if (!cooperativeId) {
    res.status(500).json({ error: "Agronome profile has no cooperative assigned" });
    return;
  }

  const [active] = await db
    .select()
    .from(deviceBindingsTable)
    .where(and(eq(deviceBindingsTable.userId, req.profile!.userId), eq(deviceBindingsTable.status, "active")));

  if (active) {
    if (active.deviceId !== deviceId) {
      res.status(403).json({ error: "device_mismatch" });
      return;
    }
    const [updated] = await db
      .update(deviceBindingsTable)
      .set({ lastSeenAt: new Date() })
      .where(eq(deviceBindingsTable.id, active.id))
      .returning();
    res.json(updated);
    return;
  }

  // Retry loop: device_code allocation is a read-then-write count, so two
  // simultaneous first claims within the same cooperative can collide on
  // the (cooperative_id, device_code) unique index — recompute and retry
  // rather than fail outright.
  for (let attempt = 0; attempt < 5; attempt++) {
    const deviceCode = await nextDeviceCode(cooperativeId);
    try {
      const [binding] = await db
        .insert(deviceBindingsTable)
        .values({
          userId: req.profile!.userId,
          cooperativeId,
          deviceId,
          deviceCode,
          deviceLabel: deviceLabel ?? null,
          status: "active",
          lastSeenAt: new Date(),
        })
        .returning();
      res.status(201).json(binding);
      return;
    } catch (err) {
      const isUniqueViolation = (err as { code?: string })?.code === "23505";
      if (isUniqueViolation && attempt < 4) continue;
      throw err;
    }
  }
  res.status(500).json({ error: "Could not allocate a device code, please retry" });
});

export default router;
