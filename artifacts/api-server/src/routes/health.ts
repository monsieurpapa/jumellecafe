import { Router, type IRouter } from "express";
import { supabaseAdmin } from "../lib/supabase.js";

const router: IRouter = Router();

router.get("/healthz", async (_req, res) => {
  const supabaseCheck = await pingSupabase();
  const healthy = supabaseCheck.status === "ok";
  res.status(healthy ? 200 : 503).json({
    status: healthy ? "ok" : "degraded",
    checks: { supabase: supabaseCheck },
  });
});

export async function pingSupabase(): Promise<{ status: "ok" | "error"; error?: string }> {
  try {
    const { error } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1 });
    if (error) return { status: "error", error: error.message };
    return { status: "ok" };
  } catch (err) {
    return { status: "error", error: err instanceof Error ? err.message : String(err) };
  }
}

export default router;
