import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import { db, livraisonsTable } from "@jumelle/db";
import { requireAuth, requireRole } from "../middlewares/auth.js";

const router: IRouter = Router();

/**
 * GET /api/livraisons — read-only bons de livraison registry for the online
 * dashboard (Phase 2), optionally filtered by ?stationId=. Super Admin must
 * pass ?cooperativeId= explicitly, same rule as /api/producteurs (plan §5).
 */
router.get(
  "/livraisons",
  requireAuth,
  requireRole("admin_cooperative", "super_admin", "auditeur"),
  async (req, res) => {
    const cooperativeId = req.profile!.cooperativeId ?? (req.query["cooperativeId"] as string | undefined);
    if (!cooperativeId) {
      res.status(400).json({ error: "cooperativeId is required" });
      return;
    }
    const stationId = req.query["stationId"] as string | undefined;
    const scope = stationId
      ? and(eq(livraisonsTable.cooperativeId, cooperativeId), eq(livraisonsTable.stationId, stationId))
      : eq(livraisonsTable.cooperativeId, cooperativeId);
    const rows = await db.select().from(livraisonsTable).where(scope);
    res.json(rows);
  },
);

export default router;
