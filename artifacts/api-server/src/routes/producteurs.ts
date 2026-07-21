import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, producteursTable } from "@jumelle/db";
import { requireAuth, requireRole } from "../middlewares/auth.js";

const router: IRouter = Router();

/**
 * GET /api/producteurs — read-only registry for the online dashboard
 * (plan §6, Phase 1c: "web-admin skeleton with a read-only Producteurs
 * list ... to visually confirm synced rows"). Super Admin has no implicit
 * cooperative scope, so it must pass ?cooperativeId= explicitly (plan §5).
 */
router.get(
  "/producteurs",
  requireAuth,
  requireRole("admin_cooperative", "super_admin", "auditeur"),
  async (req, res) => {
    const cooperativeId = req.profile!.cooperativeId ?? (req.query["cooperativeId"] as string | undefined);
    if (!cooperativeId) {
      res.status(400).json({ error: "cooperativeId is required" });
      return;
    }
    const rows = await db.select().from(producteursTable).where(eq(producteursTable.cooperativeId, cooperativeId));
    res.json(rows);
  },
);

export default router;
