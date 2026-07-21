import app from "./app.js";
import { logger } from "./lib/logger.js";
import { pingSupabase } from "./routes/health.js";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error("PORT environment variable is required but was not provided.");
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function start() {
  logger.info("Checking Supabase connectivity…");
  const supabase = await pingSupabase();
  if (supabase.status === "error") {
    logger.error(
      { error: supabase.error },
      "Startup failed: cannot reach Supabase. Check SUPABASE_URL and SERVICE_ROLE_KEY.",
    );
    process.exit(1);
  }
  logger.info("Supabase connection OK");

  app.listen(port, () => {
    logger.info({ port }, "Server listening");
  });
}

start();
