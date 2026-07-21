/**
 * Seeds one cooperative with a super_admin, an admin_cooperative, and two
 * agronome accounts — for local dev and the Phase 1d dual-device milestone
 * test (see plan §6). Requires DATABASE_URL, SUPABASE_URL, SERVICE_ROLE_KEY
 * in artifacts/api-server/.env. Safe to re-run: skips users/rows that
 * already exist by email/code.
 */
import { db, cooperativesTable, userProfilesTable } from "@jumelle/db";
import { eq } from "drizzle-orm";
import { createClient } from "@supabase/supabase-js";

const SEED_PASSWORD = "jumelle-dev-2026!"; // local/dev seed accounts only

const url = process.env["SUPABASE_URL"];
const key = process.env["SERVICE_ROLE_KEY"];
if (!url || !key) throw new Error("SUPABASE_URL and SERVICE_ROLE_KEY must be set");
const supabaseAdmin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

async function findOrCreateUser(email: string) {
  const { data: listData } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
  const existing = listData.users.find((u) => u.email === email);
  if (existing) return existing.id;

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: SEED_PASSWORD,
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(`Failed to create ${email}: ${error?.message}`);
  return data.user.id;
}

async function ensureProfile(
  userId: string,
  values: { cooperativeId: string | null; role: "super_admin" | "admin_cooperative" | "agronome" | "auditeur"; nomComplet: string },
) {
  const [existing] = await db.select().from(userProfilesTable).where(eq(userProfilesTable.userId, userId));
  if (existing) return existing;
  const [profile] = await db.insert(userProfilesTable).values({ userId, ...values }).returning();
  return profile!;
}

async function main() {
  const [existingCoop] = await db
    .select()
    .from(cooperativesTable)
    .where(eq(cooperativesTable.code, "MAENDELEO"));

  const cooperative =
    existingCoop ??
    (
      await db
        .insert(cooperativesTable)
        .values({
          code: "MAENDELEO",
          nom: "Coopérative Maendeleo",
          province: "Sud-Kivu",
          territoire: "Kalehe",
          contactEmail: "contact@maendeleo.test",
        })
        .returning()
    )[0]!;

  const superAdminId = await findOrCreateUser("super.admin@jumellecafe.test");
  await ensureProfile(superAdminId, { cooperativeId: null, role: "super_admin", nomComplet: "Super Admin" });

  const coopAdminId = await findOrCreateUser("admin@maendeleo.test");
  await ensureProfile(coopAdminId, {
    cooperativeId: cooperative.id,
    role: "admin_cooperative",
    nomComplet: "Admin Maendeleo",
  });

  const agronome1Id = await findOrCreateUser("agronome1@maendeleo.test");
  await ensureProfile(agronome1Id, {
    cooperativeId: cooperative.id,
    role: "agronome",
    nomComplet: "Jean-Baptiste Mushagalusa",
  });

  const agronome2Id = await findOrCreateUser("agronome2@maendeleo.test");
  await ensureProfile(agronome2Id, {
    cooperativeId: cooperative.id,
    role: "agronome",
    nomComplet: "Aline Kavira",
  });

  console.log("Seed complete:");
  console.log(`  Cooperative: ${cooperative.code} (${cooperative.id})`);
  console.log(`  Super Admin:      super.admin@jumellecafe.test / ${SEED_PASSWORD}`);
  console.log(`  Admin Coopérative: admin@maendeleo.test / ${SEED_PASSWORD}`);
  console.log(`  Agronome 1:        agronome1@maendeleo.test / ${SEED_PASSWORD}`);
  console.log(`  Agronome 2:        agronome2@maendeleo.test / ${SEED_PASSWORD}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
