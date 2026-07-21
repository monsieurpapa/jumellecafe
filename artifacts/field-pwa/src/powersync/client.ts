import { PowerSyncDatabase } from "@powersync/web";
import { appSchema } from "./schema.js";
import { ApiConnector } from "./connector.js";

export const powerSyncDb = new PowerSyncDatabase({
  schema: appSchema,
  database: { dbFilename: "jumelle.db" },
});

export async function connectPowerSync(): Promise<void> {
  await powerSyncDb.connect(new ApiConnector());
}
