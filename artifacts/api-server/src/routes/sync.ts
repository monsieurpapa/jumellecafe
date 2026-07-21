import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import {
  db,
  producteursTable,
  parcellesTable,
  livraisonsTable,
  stationsTable,
  inspectionsTable,
  deviceBindingsTable,
  type DeviceBinding,
} from "@jumelle/db";
import {
  producteurSyncSchema,
  parcelleSyncSchema,
  livraisonSyncSchema,
  inspectionSyncSchema,
  computeInspectionScore,
} from "@jumelle/shared";
import { requireAuth, requireRole } from "../middlewares/auth.js";

const router: IRouter = Router();

interface SyncOpBody {
  op: "PUT" | "PATCH" | "DELETE";
  id: string;
  data: Record<string, unknown> | null;
}

/**
 * Loads the caller's active device binding — required for every sync
 * upload, since device_code (part of the collision-safe producer_code
 * scheme) only comes from a genuine active binding, never the client body.
 */
async function requireActiveBinding(userId: string): Promise<DeviceBinding | null> {
  const [binding] = await db
    .select()
    .from(deviceBindingsTable)
    .where(and(eq(deviceBindingsTable.userId, userId), eq(deviceBindingsTable.status, "active")));
  return binding ?? null;
}

/**
 * POST /api/sync/producteurs — upload endpoint for the field-pwa's
 * PowerSync connector (plan §4). Idempotent on `id` (PowerSync may retry
 * after a network blip); a genuine producer_code collision with a
 * different id is a 409, never silently resolved (plan §3).
 */
router.post("/sync/producteurs", requireAuth, requireRole("agronome"), async (req, res) => {
  const { op, id, data } = req.body as SyncOpBody;

  const binding = await requireActiveBinding(req.profile!.userId);
  if (!binding) {
    res.status(403).json({ error: "no_active_device_binding" });
    return;
  }

  if (op === "DELETE") {
    await db
      .delete(producteursTable)
      .where(and(eq(producteursTable.id, id), eq(producteursTable.cooperativeId, req.profile!.cooperativeId!)));
    res.status(204).send();
    return;
  }

  const parsed = producteurSyncSchema.safeParse({ id, ...data });
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_payload", details: parsed.error.flatten() });
    return;
  }

  const values = {
    ...parsed.data,
    // Never trust cooperativeId/agronomeId/deviceCode from the client body —
    // re-derive from the authenticated session + active binding (plan §5).
    cooperativeId: req.profile!.cooperativeId!,
    agronomeId: req.profile!.userId,
    deviceCode: binding.deviceCode,
    createdOfflineAt: new Date(parsed.data.createdOfflineAt),
  };

  try {
    if (op === "PUT") {
      const [inserted] = await db
        .insert(producteursTable)
        .values(values)
        .onConflictDoNothing({ target: producteursTable.id })
        .returning();
      if (!inserted) {
        // Same id already synced — idempotent retry, not an error.
        const [existing] = await db.select().from(producteursTable).where(eq(producteursTable.id, id));
        res.status(200).json(existing);
        return;
      }
      res.status(201).json(inserted);
      return;
    }

    // op === "PATCH"
    const [updated] = await db
      .update(producteursTable)
      .set(values)
      .where(and(eq(producteursTable.id, id), eq(producteursTable.cooperativeId, req.profile!.cooperativeId!)))
      .returning();
    if (!updated) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    res.status(200).json(updated);
  } catch (err) {
    const isUniqueViolation = (err as { code?: string })?.code === "23505";
    if (isUniqueViolation) {
      res.status(409).json({ error: "producer_code_conflict" });
      return;
    }
    throw err;
  }
});

/** POST /api/sync/parcelles — same shape as /sync/producteurs, above. */
router.post("/sync/parcelles", requireAuth, requireRole("agronome"), async (req, res) => {
  const { op, id, data } = req.body as SyncOpBody;

  const binding = await requireActiveBinding(req.profile!.userId);
  if (!binding) {
    res.status(403).json({ error: "no_active_device_binding" });
    return;
  }

  if (op === "DELETE") {
    await db
      .delete(parcellesTable)
      .where(and(eq(parcellesTable.id, id), eq(parcellesTable.cooperativeId, req.profile!.cooperativeId!)));
    res.status(204).send();
    return;
  }

  const parsed = parcelleSyncSchema.safeParse({ id, ...data });
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_payload", details: parsed.error.flatten() });
    return;
  }

  // cooperativeId is re-derived here too, not trusted from the client body.
  const values = { ...parsed.data, cooperativeId: req.profile!.cooperativeId! };

  if (op === "PUT") {
    const [inserted] = await db
      .insert(parcellesTable)
      .values(values)
      .onConflictDoNothing({ target: parcellesTable.id })
      .returning();
    if (!inserted) {
      const [existing] = await db.select().from(parcellesTable).where(eq(parcellesTable.id, id));
      res.status(200).json(existing);
      return;
    }
    res.status(201).json(inserted);
    return;
  }

  const [updated] = await db
    .update(parcellesTable)
    .set(values)
    .where(and(eq(parcellesTable.id, id), eq(parcellesTable.cooperativeId, req.profile!.cooperativeId!)))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  res.status(200).json(updated);
});

/**
 * POST /api/sync/livraisons — upload endpoint for offline bons de livraison
 * (Phase 2). Same idempotent-on-id contract as /sync/producteurs; a genuine
 * bon_number collision with a different id is a 409, never silently resolved.
 */
router.post("/sync/livraisons", requireAuth, requireRole("agronome"), async (req, res) => {
  const { op, id, data } = req.body as SyncOpBody;

  const binding = await requireActiveBinding(req.profile!.userId);
  if (!binding) {
    res.status(403).json({ error: "no_active_device_binding" });
    return;
  }

  if (op === "DELETE") {
    await db
      .delete(livraisonsTable)
      .where(and(eq(livraisonsTable.id, id), eq(livraisonsTable.cooperativeId, req.profile!.cooperativeId!)));
    res.status(204).send();
    return;
  }

  const parsed = livraisonSyncSchema.safeParse({ id, ...data });
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_payload", details: parsed.error.flatten() });
    return;
  }

  // The FK alone would accept a station from ANOTHER cooperative — reject
  // cross-tenant references explicitly (plan §5's scoping rule).
  const [station] = await db.select().from(stationsTable).where(eq(stationsTable.id, parsed.data.stationId));
  if (!station || station.cooperativeId !== req.profile!.cooperativeId) {
    res.status(400).json({ error: "unknown_station" });
    return;
  }

  const values = {
    ...parsed.data,
    // Never trust cooperativeId/agronomeId/deviceCode from the client body —
    // re-derive from the authenticated session + active binding (plan §5).
    cooperativeId: req.profile!.cooperativeId!,
    agronomeId: req.profile!.userId,
    deviceCode: binding.deviceCode,
    createdOfflineAt: new Date(parsed.data.createdOfflineAt),
  };

  try {
    if (op === "PUT") {
      const [inserted] = await db
        .insert(livraisonsTable)
        .values(values)
        .onConflictDoNothing({ target: livraisonsTable.id })
        .returning();
      if (!inserted) {
        // Same id already synced — idempotent retry, not an error.
        const [existing] = await db.select().from(livraisonsTable).where(eq(livraisonsTable.id, id));
        res.status(200).json(existing);
        return;
      }
      res.status(201).json(inserted);
      return;
    }

    // op === "PATCH"
    const [updated] = await db
      .update(livraisonsTable)
      .set(values)
      .where(and(eq(livraisonsTable.id, id), eq(livraisonsTable.cooperativeId, req.profile!.cooperativeId!)))
      .returning();
    if (!updated) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    res.status(200).json(updated);
  } catch (err) {
    const isUniqueViolation = (err as { code?: string })?.code === "23505";
    if (isUniqueViolation) {
      res.status(409).json({ error: "bon_number_conflict" });
      return;
    }
    throw err;
  }
});

/**
 * POST /api/sync/inspections — upload endpoint for offline Audit Interne
 * inspections (Phase 4). score_global/conforme are recomputed here from the
 * raw criteria — the client's own computation is display-only and never
 * trusted (a tampered client must not self-certify conformity).
 */
router.post("/sync/inspections", requireAuth, requireRole("agronome"), async (req, res) => {
  const { op, id, data } = req.body as SyncOpBody;

  const binding = await requireActiveBinding(req.profile!.userId);
  if (!binding) {
    res.status(403).json({ error: "no_active_device_binding" });
    return;
  }

  if (op === "DELETE") {
    await db
      .delete(inspectionsTable)
      .where(and(eq(inspectionsTable.id, id), eq(inspectionsTable.cooperativeId, req.profile!.cooperativeId!)));
    res.status(204).send();
    return;
  }

  const parsed = inspectionSyncSchema.safeParse({ id, ...data });
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_payload", details: parsed.error.flatten() });
    return;
  }

  // Reject cross-tenant references explicitly (plan §5), same as livraisons.
  const [producteur] = await db
    .select()
    .from(producteursTable)
    .where(eq(producteursTable.id, parsed.data.producteurId));
  if (!producteur || producteur.cooperativeId !== req.profile!.cooperativeId) {
    res.status(400).json({ error: "unknown_producteur" });
    return;
  }
  if (parsed.data.parcelleId) {
    const [parcelle] = await db.select().from(parcellesTable).where(eq(parcellesTable.id, parsed.data.parcelleId));
    if (!parcelle || parcelle.cooperativeId !== req.profile!.cooperativeId) {
      res.status(400).json({ error: "unknown_parcelle" });
      return;
    }
  }

  const { scoreGlobal, conforme } = computeInspectionScore(parsed.data);

  const values = {
    ...parsed.data,
    parcelleId: parsed.data.parcelleId ?? null,
    scoreGlobal,
    conforme,
    cooperativeId: req.profile!.cooperativeId!,
    agronomeId: req.profile!.userId,
    deviceCode: binding.deviceCode,
    createdOfflineAt: new Date(parsed.data.createdOfflineAt),
  };

  if (op === "PUT") {
    const [inserted] = await db
      .insert(inspectionsTable)
      .values(values)
      .onConflictDoNothing({ target: inspectionsTable.id })
      .returning();
    if (!inserted) {
      const [existing] = await db.select().from(inspectionsTable).where(eq(inspectionsTable.id, id));
      res.status(200).json(existing);
      return;
    }
    res.status(201).json(inserted);
    return;
  }

  // op === "PATCH"
  const [updated] = await db
    .update(inspectionsTable)
    .set(values)
    .where(and(eq(inspectionsTable.id, id), eq(inspectionsTable.cooperativeId, req.profile!.cooperativeId!)))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  res.status(200).json(updated);
});

export default router;
