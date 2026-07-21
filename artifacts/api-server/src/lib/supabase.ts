import { createClient } from "@supabase/supabase-js";

const url = process.env["SUPABASE_URL"];
const key = process.env["SERVICE_ROLE_KEY"];

if (!url || !key) {
  throw new Error("SUPABASE_URL and SERVICE_ROLE_KEY must be set");
}

/** Server-side admin client — never expose this key to any client. */
export const supabaseAdmin = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});
