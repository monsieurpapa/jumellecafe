import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, userProfilesTable, cooperativesTable } from "@jumelle/db";
import { requireAuth } from "../middlewares/auth.js";

const router: IRouter = Router();

/** GET /api/me — the caller's own profile + cooperative, for any authenticated role. */
router.get("/me", requireAuth, async (req, res) => {
  const [profile] = await db
    .select()
    .from(userProfilesTable)
    .where(eq(userProfilesTable.userId, req.user!.id));

  if (!profile) {
    res.status(404).json({ error: "No user_profiles row for this account yet" });
    return;
  }

  let cooperative = null;
  if (profile.cooperativeId) {
    const [coop] = await db
      .select()
      .from(cooperativesTable)
      .where(eq(cooperativesTable.id, profile.cooperativeId));
    cooperative = coop ?? null;
  }

  res.json({
    user: { id: req.user!.id, email: req.user!.email },
    profile,
    cooperative,
  });
});

export default router;
