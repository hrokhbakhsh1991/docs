import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, it } from "node:test";

const REPO_ROOT = join(import.meta.dirname, "..", "..");

function hashFile(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

describe("CW9-07 registry regeneration determinism", () => {
  it("CW9-07-01 two registry generations are byte-identical with synthetics present", () => {
    const sdkBindings = join(
      REPO_ROOT,
      "packages/workspace-sdk/src/plugin/workspace-manifest-bindings.generated.ts"
    );
    const before = hashFile(sdkBindings);

    const first = spawnSync("pnpm", ["run", "generate:workspace-registry"], {
      cwd: REPO_ROOT,
      encoding: "utf8",
    });
    assert.equal(first.status, 0, first.stderr || first.stdout);
    const mid = hashFile(sdkBindings);

    const second = spawnSync("pnpm", ["run", "generate:workspace-registry"], {
      cwd: REPO_ROOT,
      encoding: "utf8",
    });
    assert.equal(second.status, 0, second.stderr || second.stdout);
    const after = hashFile(sdkBindings);

    assert.equal(before, mid, "first regen must not change bindings hash");
    assert.equal(mid, after, "second regen must be byte-identical");
  });
});
