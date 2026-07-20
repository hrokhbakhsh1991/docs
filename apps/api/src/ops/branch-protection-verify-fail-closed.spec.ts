/**
 * TODO-005 — branch protection verify must fail-closed without gh auth.
 * Does not claim live main is protected (that needs authenticated apply).
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const here = dirname(fileURLToPath(import.meta.url));
const script = join(here, "../../../../scripts/ops/configure-main-branch-protection.mjs");

describe("TODO-005 branch protection verify fail-closed", () => {
  it("--print-only exits 0 and lists Booking checks", () => {
    const probe = spawnSync(process.execPath, [script, "--print-only"], { encoding: "utf8" });
    assert.equal(probe.status, 0, probe.stderr);
    assert.match(probe.stdout, /Booking HTTP PostgreSQL/);
    assert.match(probe.stdout, /Booking PostgreSQL capacity/);
  });

  it("--verify exits non-zero when gh is unauthenticated", () => {
    const probe = spawnSync(process.execPath, [script, "--verify"], {
      encoding: "utf8",
      env: {
        ...process.env,
        GH_TOKEN: "",
        GITHUB_TOKEN: "",
        // Force gh to see no credentials even if user config exists in some environments.
        GH_CONFIG_DIR: join(here, ".gh-empty-config-dir-does-not-exist"),
      },
    });
    assert.notEqual(probe.status, 0);
    assert.match(`${probe.stdout}\n${probe.stderr}`, /gh not authenticated|not logged into|ERROR/i);
  });
});
