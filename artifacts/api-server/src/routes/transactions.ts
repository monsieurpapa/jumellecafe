import { Router, type IRouter } from "express";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, transactionsTable } from "@jumelle/db";
import { transactionCreateSchema } from "@jumelle/shared";
import { requireAuth, requireRole } from "../middlewares/auth.js";

const router: IRouter = Router();

/**
 * GET /api/transactions — Finance / Collecte & Prix registry (Phase 5).
 * Super Admin passes ?cooperativeId= explicitly, same rule as elsewhere (plan §5).
 */
router.get(
  "/transactions",
  requireAuth,
  requireRole("admin_cooperative", "super_admin", "auditeur"),
  async (req, res) => {
    const cooperativeId = req.profile!.cooperativeId ?? (req.query["cooperativeId"] as string | undefined);
    if (!cooperativeId) {
      res.status(400).json({ error: "cooperativeId is required" });
      return;
    }
    const rows = await db
      .select()
      .from(transactionsTable)
      .where(eq(transactionsTable.cooperativeId, cooperativeId));
    res.json(rows);
  },
);

/**
 * POST /api/transactions — Admin records an achat/vente. montant is
 * computed here (quantite × prix) and the reference is server-generated;
 * neither is ever accepted from the client body.
 */
router.post("/transactions", requireAuth, requireRole("admin_cooperative"), async (req, res) => {
  const parsed = transactionCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_payload", details: parsed.error.flatten() });
    return;
  }

  const montantCdf = Math.round(parsed.data.quantiteKg * parsed.data.prixUnitaireCdf * 100) / 100;
  const reference = `TRX-${randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()}`;

  const [transaction] = await db
    .insert(transactionsTable)
    .values({
      ...parsed.data,
      cooperativeId: req.profile!.cooperativeId!,
      reference,
      montantCdf,
      createdBy: req.profile!.userId,
    })
    .returning();
  res.status(201).json(transaction);
});

export default router;
