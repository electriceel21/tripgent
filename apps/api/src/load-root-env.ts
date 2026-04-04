import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";

/**
 * Load `<repo>/.env` when running from `apps/api` (src or dist). Falls back silently if missing.
 */
export function loadRootEnv(): void {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const rootEnv = path.resolve(here, "../../../.env");
  if (existsSync(rootEnv)) {
    config({ path: rootEnv });
  }
}
