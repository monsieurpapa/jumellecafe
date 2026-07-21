import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import { db, inspectionsTable } from "@jumelle/db";
import { requireAuth, requireRole } from "../middlewares/auth.js";

const router: IRouter = Router();

/**
 * GET /api/inspections — Audit Interne registry for the online dashboard
 * (Phase 4), optionally filtered by ?producteurId=. Super Admin passes
 * ?cooperativeId= explicitly, same rule as /api/producteurs (plan §5).
 */
router.get(
  "/inspections",
  requireAuth,
  requireRole("admin_cooperative", "super_admin", "auditeur"),
  async (req, res) => {
    const cooperativeId = req.profile!.cooperativeId ?? (req.query["cooperativeId"] as string | undefined);
    if (!cooperativeId) {
      res.status(400).json({ error: "cooperativeId is required" });
      return;
    }
    const producteurId = req.query["producteurId"] as string | undefined;
    const scope = producteurId
      ? and(eq(inspectionsTable.cooperativeId, cooperativeId), eq(inspectionsTable.producteurId, producteurId))
      : eq(inspectionsTable.cooperativeId, cooperativeId);
    const rows = await db.select().from(inspectionsTable).where(scope);
    res.json(rows);
  },
);

export default router;
