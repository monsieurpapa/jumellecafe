import { Router, type IRouter } from "express";
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db, transactionsTable } from "@jumelle/db";
import { transactionCreateSchema, transactionUpdateSchema } from "@jumelle/shared";
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

/**
 * PATCH /api/transactions/:id — Admin corrects a data-entry mistake.
 * montant_cdf is always recomputed from quantite × prix (never trusted from
 * the client), same rule as POST. Scoped to the caller's own cooperative in
 * the WHERE clause — the ownership-scoping fix applied to sync.ts earlier.
 */
router.patch("/transactions/:id", requireAuth, requireRole("admin_cooperative"), async (req, res) => {
  const parsed = transactionUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_payload", details: parsed.error.flatten() });
    return;
  }
  const transactionId = String(req.params["id"]);
  const cooperativeId = req.profile!.cooperativeId!;

  const [existing] = await db
    .select()
    .from(transactionsTable)
    .where(and(eq(transactionsTable.id, transactionId), eq(transactionsTable.cooperativeId, cooperativeId)));
  if (!existing) {
    res.status(404).json({ error: "not_found" });
    return;
  }

  const quantiteKg = parsed.data.quantiteKg ?? existing.quantiteKg;
  const prixUnitaireCdf = parsed.data.prixUnitaireCdf ?? existing.prixUnitaireCdf;
  const montantCdf = Math.round(quantiteKg * prixUnitaireCdf * 100) / 100;

  const [updated] = await db
    .update(transactionsTable)
    .set({ ...parsed.data, montantCdf })
    .where(and(eq(transactionsTable.id, transactionId), eq(transactionsTable.cooperativeId, cooperativeId)))
    .returning();
  res.status(200).json(updated);
});

/**
 * DELETE /api/transactions/:id — Admin removes a mis-entered transaction.
 * Unlike lots/producteurs (the EUDR audit trail), transactions are an
 * internal ledger where correction-by-deletion is acceptable. Scoped to the
 * caller's own cooperative, same pattern as PATCH above.
 */
router.delete("/transactions/:id", requireAuth, requireRole("admin_cooperative"), async (req, res) => {
  const transactionId = String(req.params["id"]);
  await db
    .delete(transactionsTable)
    .where(
      and(eq(transactionsTable.id, transactionId), eq(transactionsTable.cooperativeId, req.profile!.cooperativeId!)),
    );
  res.status(204).send();
});

export default router;
