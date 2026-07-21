import type { Request, Response, NextFunction } from "express";
import { eq } from "drizzle-orm";
import { db, userProfilesTable, type Role, type UserProfile } from "@jumelle/db";
import { supabaseAdmin } from "../lib/supabase.js";

export interface AuthUser {
  id: string;
  email: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      profile?: UserProfile;
    }
  }
}

/** Verifies the Supabase Bearer JWT and attaches req.user. */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing authorization header" });
    return;
  }
  const token = header.slice(7);
  const {
    data: { user },
    error,
  } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }
  req.user = { id: user.id, email: user.email ?? "" };
  next();
}

/**
 * Requires requireAuth to have already run. Loads the caller's user_profiles
 * row, rejects inactive/unrecognized users, and rejects roles not in `allowed`.
 * Attaches req.profile so routes can read { role, cooperativeId } without a
 * second lookup. Super Admin has cooperativeId = null and must never be
 * treated as scoped to a tenant implicitly (see plan §5).
 */
export function requireRole(...allowed: Role[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ error: "requireAuth must run before requireRole" });
      return;
    }
    const [profile] = await db
      .select()
      .from(userProfilesTable)
      .where(eq(userProfilesTable.userId, req.user.id));

    if (!profile?.actif) {
      res.status(403).json({ error: "forbidden" });
      return;
    }
    if (!allowed.includes(profile.role)) {
      res.status(403).json({ error: "forbidden" });
      return;
    }
    req.profile = profile;
    next();
  };
}
