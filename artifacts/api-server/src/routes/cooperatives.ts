import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, cooperativesTable, userProfilesTable, insertCooperativeSchema, cooperativeUpdateSchema } from "@jumelle/db";
import { requireAuth, requireRole } from "../middlewares/auth.js";
import { supabaseAdmin } from "../lib/supabase.js";

const router: IRouter = Router();

/**
 * GET /api/cooperatives — Super Admin only. Full list, used by the
 * web-admin Coopératives screen and to populate the cooperative picker
 * Super Admin needs to scope every other screen (see plan §5).
 */
router.get("/cooperatives", requireAuth, requireRole("super_admin"), async (_req, res) => {
  const rows = await db.select().from(cooperativesTable);
  res.json(rows);
});

/**
 * POST /api/cooperatives — Super Admin only. Creates a cooperative and its
 * first Admin Coopérative user (inviting them via Supabase Auth if they
 * don't already have an account). See plan §6, Phase 1a.
 */
router.post("/cooperatives", requireAuth, requireRole("super_admin"), async (req, res) => {
  const parsed = insertCooperativeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid cooperative payload", details: parsed.error.flatten() });
    return;
  }

  const { adminEmail, adminNomComplet } = req.body as {
    adminEmail?: string;
    adminNomComplet?: string;
  };
  if (!adminEmail) {
    res.status(400).json({ error: "adminEmail is required" });
    return;
  }

  const [existingCode] = await db
    .select()
    .from(cooperativesTable)
    .where(eq(cooperativesTable.code, parsed.data.code));
  if (existingCode) {
    res.status(409).json({ error: "A cooperative with this code already exists" });
    return;
  }

  let cooperative: typeof cooperativesTable.$inferSelect;
  try {
    [cooperative] = await db.insert(cooperativesTable).values(parsed.data).returning();
  } catch (err) {
    const isUniqueViolation = (err as { code?: string })?.code === "23505";
    if (isUniqueViolation) {
      res.status(409).json({ error: "A cooperative with this code already exists" });
      return;
    }
    throw err;
  }

  // Find an existing Supabase user by email, or invite a new one — same
  // pattern as kazi's organizations.ts invite flow.
  const { data: listData } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
  const existingUser = listData.users.find((u) => u.email === adminEmail);

  let adminUserId: string;
  if (existingUser) {
    adminUserId = existingUser.id;
  } else {
    const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      adminEmail,
      { data: { invited_role: "admin_cooperative", cooperative_id: cooperative!.id } },
    );
    if (inviteError || !inviteData.user) {
      res.status(500).json({ error: inviteError?.message ?? "Failed to invite admin user" });
      return;
    }
    adminUserId = inviteData.user.id;
  }

  const [existingProfile] = await db
    .select()
    .from(userProfilesTable)
    .where(eq(userProfilesTable.userId, adminUserId));
  if (existingProfile) {
    res.status(409).json({ error: "This user already has a profile on the platform" });
    return;
  }

  const [profile] = await db
    .insert(userProfilesTable)
    .values({
      userId: adminUserId,
      cooperativeId: cooperative!.id,
      role: "admin_cooperative",
      nomComplet: adminNomComplet ?? null,
      actif: true,
    })
    .returning();

  res.status(201).json({ cooperative, adminProfile: profile });
});

/**
 * PATCH /api/cooperatives/:id — Super Admin only. Edits coop details and/or
 * toggles `actif` (deactivate/reactivate) — `code` stays immutable after
 * onboarding, same rule PATCH /api/stations/:id already applies.
 */
router.patch("/cooperatives/:id", requireAuth, requireRole("super_admin"), async (req, res) => {
  const parsed = cooperativeUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_payload", details: parsed.error.flatten() });
    return;
  }
  const cooperativeId = String(req.params["id"]);
  const [updated] = await db
    .update(cooperativesTable)
    .set(parsed.data)
    .where(eq(cooperativesTable.id, cooperativeId))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  res.status(200).json(updated);
});

export default router;
