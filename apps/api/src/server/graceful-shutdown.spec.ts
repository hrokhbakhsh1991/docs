import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

describe("graceful-shutdown logging (LOG-COL-04)", () => {
  it("uses structured logger without console.error or error message interpolation", () => {
    const source = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "graceful-shutdown.ts"),
      "utf8"
    );
    assert.doesNotMatch(source, /console\.(log|error|warn)/);
    assert.match(source, /graceful_shutdown\.failed/);
    assert.match(source, /GRACEFUL_SHUTDOWN_FAILED/);
    assert.doesNotMatch(source, /error\.message/);
  });
});
