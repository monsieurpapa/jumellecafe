import { Router, type IRouter } from "express";
import { randomUUID } from "node:crypto";
import { and, eq, inArray, count, countDistinct } from "drizzle-orm";
import {
  db,
  lotsTable,
  livraisonsTable,
  producteursTable,
  parcellesTable,
  stationsTable,
  cooperativesTable,
} from "@jumelle/db";
import { lotCreateSchema, lotUpdateSchema, generateLotCode } from "@jumelle/shared";
import { requireAuth, requireRole } from "../middlewares/auth.js";

const router: IRouter = Router();

/**
 * GET /api/lots — lots with livraison/producteur counts for the Traçabilité
 * dashboard (Phase 3). Super Admin passes ?cooperativeId= explicitly (plan §5).
 */
router.get(
  "/lots",
  requireAuth,
  requireRole("admin_cooperative", "super_admin", "auditeur"),
  async (req, res) => {
    const cooperativeId = req.profile!.cooperativeId ?? (req.query["cooperativeId"] as string | undefined);
    if (!cooperativeId) {
      res.status(400).json({ error: "cooperativeId is required" });
      return;
    }
    const rows = await db
      .select({
        lot: lotsTable,
        livraisonsCount: count(livraisonsTable.id),
        producteursCount: countDistinct(livraisonsTable.producteurId),
      })
      .from(lotsTable)
      .leftJoin(livraisonsTable, eq(livraisonsTable.lotId, lotsTable.id))
      .where(eq(lotsTable.cooperativeId, cooperativeId))
      .groupBy(lotsTable.id);
    res.json(rows.map((r) => ({ ...r.lot, livraisonsCount: r.livraisonsCount, producteursCount: r.producteursCount })));
  },
);

/**
 * GET /api/lots/:id — full chain of custody for one lot: its livraisons
 * (with producteur identity) and the GPS parcelles of every producteur
 * involved. This is the EUDR evidence trail: parcelle → producteur →
 * livraison → lot.
 */
router.get(
  "/lots/:id",
  requireAuth,
  requireRole("admin_cooperative", "super_admin", "auditeur"),
  async (req, res) => {
    const cooperativeId = req.profile!.cooperativeId ?? (req.query["cooperativeId"] as string | undefined);
    if (!cooperativeId) {
      res.status(400).json({ error: "cooperativeId is required" });
      return;
    }
    const lotId = String(req.params["id"]);
    const [lot] = await db
      .select()
      .from(lotsTable)
      .where(and(eq(lotsTable.id, lotId), eq(lotsTable.cooperativeId, cooperativeId)));
    if (!lot) {
      res.status(404).json({ error: "not_found" });
      return;
    }

    const livraisons = await db
      .select({ livraison: livraisonsTable, producteur: producteursTable })
      .from(livraisonsTable)
      .innerJoin(producteursTable, eq(livraisonsTable.producteurId, producteursTable.id))
      .where(eq(livraisonsTable.lotId, lot.id));

    const producteurIds = [...new Set(livraisons.map((l) => l.producteur.id))];
    const parcelles = producteurIds.length
      ? await db.select().from(parcellesTable).where(inArray(parcellesTable.producteurId, producteurIds))
      : [];

    res.json({ lot, livraisons, parcelles });
  },
);

/**
 * POST /api/lots — constitute a lot from un-lotted livraisons of ONE
 * station (Phase 3, online-only). Weight is frozen as the sum of the
 * selected livraisons; EUDR conformity is true iff every producteur
 * involved has at least one GPS parcelle.
 */
router.post("/lots", requireAuth, requireRole("admin_cooperative"), async (req, res) => {
  const parsed = lotCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_payload", details: parsed.error.flatten() });
    return;
  }
  const cooperativeId = req.profile!.cooperativeId!;
  const { stationId, culture, livraisonIds, acheteur, paysDestination } = parsed.data;

  const [station] = await db.select().from(stationsTable).where(eq(stationsTable.id, stationId));
  if (!station || station.cooperativeId !== cooperativeId) {
    res.status(400).json({ error: "unknown_station" });
    return;
  }

  const livraisons = await db
    .select()
    .from(livraisonsTable)
    .where(and(inArray(livraisonsTable.id, livraisonIds), eq(livraisonsTable.cooperativeId, cooperativeId)));

  if (livraisons.length !== livraisonIds.length) {
    res.status(400).json({ error: "unknown_livraisons" });
    return;
  }
  if (livraisons.some((l) => l.stationId !== stationId)) {
    res.status(400).json({ error: "livraisons_not_from_station" });
    return;
  }
  if (livraisons.some((l) => l.lotId !== null)) {
    res.status(409).json({ error: "livraisons_already_lotted" });
    return;
  }

  const producteurIds = [...new Set(livraisons.map((l) => l.producteurId))];
  const locatedParcelles = await db
    .select({ producteurId: parcellesTable.producteurId })
    .from(parcellesTable)
    .where(inArray(parcellesTable.producteurId, producteurIds));
  const locatedProducteurs = new Set(locatedParcelles.map((p) => p.producteurId));
  const eudrConforme = producteurIds.every((id) => locatedProducteurs.has(id));

  const poidsKg = livraisons.reduce((sum, l) => sum + l.poidsKg, 0);

  const [cooperative] = await db.select().from(cooperativesTable).where(eq(cooperativesTable.id, cooperativeId));
  const code = generateLotCode({
    coopCode: cooperative!.code,
    culture,
    unique: randomUUID().replace(/-/g, "").slice(0, 8),
  });

  const lot = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(lotsTable)
      .values({
        cooperativeId,
        stationId,
        code,
        culture,
        poidsKg,
        eudrConforme,
        acheteur: acheteur ?? null,
        paysDestination: paysDestination ?? null,
      })
      .returning();
    await tx
      .update(livraisonsTable)
      .set({ lotId: created!.id })
      .where(inArray(livraisonsTable.id, livraisonIds));
    return created!;
  });

  res.status(201).json({ ...lot, livraisonsCount: livraisons.length, producteursCount: producteurIds.length });
});

/**
 * PATCH /api/lots/:id — export bookkeeping (statut, acheteur, destination,
 * date d'export). Never composition or weight: those are frozen history.
 */
router.patch("/lots/:id", requireAuth, requireRole("admin_cooperative"), async (req, res) => {
  const parsed = lotUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_payload", details: parsed.error.flatten() });
    return;
  }
  const lotId = String(req.params["id"]);
  const [updated] = await db
    .update(lotsTable)
    .set(parsed.data)
    .where(and(eq(lotsTable.id, lotId), eq(lotsTable.cooperativeId, req.profile!.cooperativeId!)))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  res.status(200).json(updated);
});

export default router;
