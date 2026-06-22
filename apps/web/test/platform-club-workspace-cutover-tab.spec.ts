/**
 * P5-A-N-004 — Super Admin cutover badge on workspace tab
 * @see docs/phase-18/platform-metadata-cutover-pilot.mdoc (UI-01..02)
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

describe("platform-club-workspace-cutover-tab (P5-A UI-01..02)", () => {
  it("UI-01 workspace tab renders cutover badge test id", () => {
    const source = readFileSync(
      new URL("../src/platform/club-detail/tab-workspace-definition.tsx", import.meta.url),
      "utf8"
    );
    assert.match(source, /data-testid="platform-workspace-cutover-badge"/);
    assert.match(source, /data-metadata-cutover-stage=\{cutoverStage\}/);
  });

  it("UI-02 badge reads stage and version from binding DTO shape", () => {
    const tab = readFileSync(
      new URL("../src/platform/club-detail/tab-workspace-definition.tsx", import.meta.url),
      "utf8"
    );
    const types = readFileSync(
      new URL("../src/platform/club-detail/platform-club-detail.types.ts", import.meta.url),
      "utf8"
    );
    const client = readFileSync(
      new URL("../src/platform/club-detail/platform-club-detail-client.tsx", import.meta.url),
      "utf8"
    );
    assert.match(tab, /binding\?\.metadataCutoverStage/);
    assert.match(tab, /binding\?\.definitionVersion/);
    assert.match(types, /metadataCutoverStage: "off" \| "pilot" \| "live"/);
    assert.match(client, /binding=\{detail\.workspaceDefinition\}/);
  });
});
