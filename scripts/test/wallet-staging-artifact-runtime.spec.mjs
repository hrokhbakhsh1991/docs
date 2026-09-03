/**
 * Clean-room runtime proof for the bundled Denali Wallet pilot seed.
 * Set STAGING_ARTIFACT to a built .tar.zst; this test never uses the checkout
 * as a module source and intentionally stops before any database work.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, it } from "node:test";

const artifact = process.env.STAGING_ARTIFACT;

describe("wallet-staging-artifact-runtime", () => {
  it("resolves and loads the pilot seed from an isolated artifact", (t) => {
    if (!artifact) {
      t.skip("STAGING_ARTIFACT is required after a clean artifact build");
      return;
    }

    const artifactPath = resolve(artifact);
    const work = mkdtempSync(join(tmpdir(), "wallet-staging-artifact-"));
    try {
      execFileSync("tar", ["-I", "zstd", "-xf", artifactPath, "-C", work], {
        stdio: "pipe",
      });
      const releaseDir = join(work, artifactPath.match(/([^/]+)\.tar\.zst$/u)?.[1] ?? "");
      const apiNodeModules = join(releaseDir, "api", "node_modules");
      const pilotPackage = join(apiNodeModules, "@app-tour", "booking-http-contracts");
      const resolved = execFileSync(
        process.execPath,
        ["-e", "process.stdout.write(require.resolve('@app-tour/booking-http-contracts'))"],
        {
          cwd: join(releaseDir, "api"),
          env: {
            NODE_PATH: `${apiNodeModules}:${join(apiNodeModules, ".pnpm", "node_modules")}`,
          },
          encoding: "utf8",
        }
      );
      assert.match(resolved, /booking-http-contracts/);
      assert.match(readFileSync(join(pilotPackage, "package.json"), "utf8"), /booking-http-contracts/);

      const envFile = join(work, "empty.env");
      writeFileSync(envFile, "DATABASE_URL=\nDATABASE_URL_ADMIN=\n", "utf8");
      let output = "";
      try {
        execFileSync("bash", [join(releaseDir, "bin", "seed-denali-wallet-pilot.sh"), envFile], {
          cwd: work,
          env: { PATH: process.env.PATH },
          encoding: "utf8",
          stdio: ["ignore", "pipe", "pipe"],
        });
      } catch (error) {
        output = `${error.stdout ?? ""}${error.stderr ?? ""}`;
      }
      assert.match(output, /DENALI_WALLET_PILOT_REQUIRES_DATABASE_URL/);
      assert.doesNotMatch(output, /Cannot find module.*booking-http-contracts/);
      assert.doesNotMatch(output, /ERR_INVALID_ARG_TYPE.*fileURLToPath/s);
    } finally {
      rmSync(work, { recursive: true, force: true });
    }
  });
});
