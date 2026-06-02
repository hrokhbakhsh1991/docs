import { spawnSync } from "node:child_process";
import * as path from "node:path";

/**
 * Runs an `apps/api` node:test file (Testcontainers + tsx) from the monorepo root Jest harness.
 */
export function runAppsApiE2e(suiteFileName: string): void {
  const apiDir = path.resolve(__dirname, "../../apps/api");
  const suitePath = path.join(apiDir, "test/e2e", suiteFileName);
  const result = spawnSync(
    "pnpm",
    ["exec", "node", "--import", "tsx", "--test", suitePath],
    {
      cwd: apiDir,
      stdio: "inherit",
      env: process.env
    }
  );
  expect(result.status).toBe(0);
}
