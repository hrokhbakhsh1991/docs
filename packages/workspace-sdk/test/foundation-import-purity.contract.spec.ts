import assert from "node:assert/strict";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const AUDIT_SCRIPT = path.join(REPO_ROOT, "scripts/guards/foundation-import-purity-audit.mjs");

describe("foundation import purity AST audit (row 36)", () => {
  it("passes production-only graph with no @casl/ability on workspace-sdk foundation src", () => {
    const r = spawnSync(process.execPath, [AUDIT_SCRIPT, "--production-only"], {
      cwd: REPO_ROOT,
      encoding: "utf8",
    });
    const out = `${r.stdout ?? ""}${r.stderr ?? ""}`.trim();
    assert.equal(r.status, 0, out || "foundation-import-purity-audit failed");
    if (out.length > 0) {
      assert.match(out, /foundation-import-purity-audit: PASS/i);
    }
  });
});
