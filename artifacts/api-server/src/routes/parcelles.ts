import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, parcellesTable, producteursTable } from "@jumelle/db";
import { requireAuth, requireRole } from "../middlewares/auth.js";

const router: IRouter = Router();

/**
 * GET /api/parcelles — GPS plots with producteur identity, for the
 * Parcelles GPS map (Phase 4). Super Admin passes ?cooperativeId=
 * explicitly, same convention as every other list route (plan §5).
 */
router.get(
  "/parcelles",
  requireAuth,
  requireRole("admin_cooperative", "super_admin", "auditeur"),
  async (req, res) => {
    const cooperativeId = req.profile!.cooperativeId ?? (req.query["cooperativeId"] as string | undefined);
    if (!cooperativeId) {
      res.status(400).json({ error: "cooperativeId is required" });
      return;
    }
    const rows = await db
      .select({ parcelle: parcellesTable, producteur: producteursTable })
      .from(parcellesTable)
      .innerJoin(producteursTable, eq(parcellesTable.producteurId, producteursTable.id))
      .where(eq(parcellesTable.cooperativeId, cooperativeId));
    res.json(rows);
  },
);

export default router;
