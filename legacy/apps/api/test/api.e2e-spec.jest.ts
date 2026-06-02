import { spawnSync } from "node:child_process";
import * as path from "node:path";

/**
 * Jest harness for the node:test suite at {@link ./api.e2e-spec.ts}.
 * Run: `pnpm --filter @apps/api exec jest test/api.e2e-spec.jest.ts --runInBand --forceExit`
 */
describe("api.e2e-spec (node:test)", () => {
  it("runs test/api.e2e-spec.ts with 0 failures", () => {
    const apiDir = path.resolve(__dirname, "..");
    const result = spawnSync(
      process.execPath,
      ["--import", "tsx", "--test", "--test-concurrency=1", "test/api.e2e-spec.ts"],
      {
        cwd: apiDir,
        stdio: "inherit",
        env: process.env
      }
    );
    expect(result.status).toBe(0);
  });
});
