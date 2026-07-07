import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const denaliReadme = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../../../packages/workspaces/denali/README.md"),
  "utf8"
);

describe("workspace-metadata-denali-maintenance", () => {
  it("DM-01 README contains maintenance notice", () => {
    assert.match(denaliReadme, /maintenance/i);
  });

  it("DM-02 README references metadata export workflow", () => {
    assert.match(denaliReadme, /metadata/i);
    assert.match(denaliReadme, /export/i);
    assert.match(denaliReadme, /workspace metadata definitions/i);
  });
});
