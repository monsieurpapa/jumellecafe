import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import { db, stationsTable, insertStationSchema, stationUpdateSchema } from "@jumelle/db";
import { requireAuth, requireRole } from "../middlewares/auth.js";

const router: IRouter = Router();

/**
 * GET /api/stations — stations de lavage + points de collecte for the
 * online dashboard (Phase 2). Super Admin has no implicit cooperative
 * scope, so it must pass ?cooperativeId= explicitly (plan §5). The
 * field-pwa never calls this — it receives stations through PowerSync.
 */
router.get(
  "/stations",
  requireAuth,
  requireRole("admin_cooperative", "super_admin", "auditeur"),
  async (req, res) => {
    const cooperativeId = req.profile!.cooperativeId ?? (req.query["cooperativeId"] as string | undefined);
    if (!cooperativeId) {
      res.status(400).json({ error: "cooperativeId is required" });
      return;
    }
    const rows = await db.select().from(stationsTable).where(eq(stationsTable.cooperativeId, cooperativeId));
    res.json(rows);
  },
);

/**
 * POST /api/stations — Admin Coopérative creates a station for their own
 * cooperative (cooperativeId is forced from the session, never the body).
 */
router.post("/stations", requireAuth, requireRole("admin_cooperative"), async (req, res) => {
  const parsed = insertStationSchema.safeParse({
    ...req.body,
    cooperativeId: req.profile!.cooperativeId,
  });
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_payload", details: parsed.error.flatten() });
    return;
  }

  const [existingCode] = await db
    .select()
    .from(stationsTable)
    .where(and(eq(stationsTable.cooperativeId, parsed.data.cooperativeId), eq(stationsTable.code, parsed.data.code)));
  if (existingCode) {
    res.status(409).json({ error: "station_code_conflict" });
    return;
  }

  try {
    const [station] = await db.insert(stationsTable).values(parsed.data).returning();
    res.status(201).json(station);
  } catch (err) {
    const isUniqueViolation = (err as { code?: string })?.code === "23505";
    if (isUniqueViolation) {
      res.status(409).json({ error: "station_code_conflict" });
      return;
    }
    throw err;
  }
});

/**
 * PATCH /api/stations/:id — Admin Coopérative edits a station's details or
 * changes its statut (active/partielle/inactive) after creation. code and
 * cooperativeId are immutable, same rule as PATCH /api/lots/:id.
 */
router.patch("/stations/:id", requireAuth, requireRole("admin_cooperative"), async (req, res) => {
  const parsed = stationUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_payload", details: parsed.error.flatten() });
    return;
  }
  const stationId = String(req.params["id"]);
  const [updated] = await db
    .update(stationsTable)
    .set(parsed.data)
    .where(and(eq(stationsTable.id, stationId), eq(stationsTable.cooperativeId, req.profile!.cooperativeId!)))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  res.status(200).json(updated);
});

export default router;
