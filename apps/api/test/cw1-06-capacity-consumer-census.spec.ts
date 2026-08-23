import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { describe, it } from "node:test";

describe("CW1-06 capacity strategy consumer census", () => {
  it("no non-re-export production imports of legacy registration-capacity math paths", () => {
    const compatPaths = new Set([
      "apps/api/src/registrations/registration-capacity.service.ts",
      "apps/api/src/registrations/index.ts",
    ]);
    const output = execSync(
      'rg "resolveRegistrationCapacityDecision|sumAcceptedRegistrationSeats" apps/api/src packages/workspaces --glob "!**/*.spec.ts" -l || true',
      { cwd: new URL("../../..", import.meta.url).pathname, encoding: "utf8" }
    )
      .trim()
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .filter((rel) => !compatPaths.has(rel))
      .join("\n");
    assert.equal(output, "", `unexpected legacy capacity imports:\n${output}`);
  });
});
