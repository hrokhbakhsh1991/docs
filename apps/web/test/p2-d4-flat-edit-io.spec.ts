/**
 * P2-D4.a — flat-edit orchestration I/O ports (boundary proofs).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const WEB_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function readWeb(rel: string): string {
  return readFileSync(resolve(WEB_ROOT, rel), "utf8");
}

describe("p2-d4-flat-edit-io.spec.ts — P2-D4.a", () => {
  it("P2-D4.a-01 hook injects OperatorFlatEditPageIo; no hard-coded tour/template API paths", () => {
    const hook = readWeb("src/wizard/use-flat-edit-page.ts");
    assert.match(hook, /OperatorFlatEditPageIo/);
    assert.match(hook, /webOperatorFlatEditPageIo/);
    assert.match(hook, /\.loadWizardTemplatePayload\(/);
    assert.match(hook, /io\.loadTourBaseline/);
    assert.match(hook, /io\.updateTour/);
    assert.match(hook, /readonly plugin:/);
    assert.doesNotMatch(hook, /resolveDenaliSyncWorkspacePlugin/);
    assert.doesNotMatch(hook, /\/api\/tours\//);
    assert.doesNotMatch(hook, /\/api\/settings\/tour-wizard-template/);
    assert.doesNotMatch(hook, /\/api\/settings\/resources\/equipment/);
    assert.doesNotMatch(hook, /from ["']@\/tours\/update-tour\.server["']/);
  });

  it("P2-D4.a-03 page client loads plugin via registry before mounting hook (Wave B.c / I.6)", () => {
    const client = readWeb("app/(app)/tours/[id]/edit/flat-edit-page-client.tsx");
    assert.match(client, /warmOperatorWizardShell\(session\.pluginId\)/);
    assert.match(client, /useOperatorFlatEditPage\(\{ session, tourId, plugin \}/);
  });

  it("P2-D4.a-02 web adapter owns BFF paths + updateTourAction", () => {
    const io = readWeb("src/wizard/web-operator-flat-edit-page-io.ts");
    assert.match(io, /webOperatorFlatEditPageIo/);
    assert.match(io, /\/api\/settings\/tour-wizard-template/);
    assert.match(io, /\/api\/tours\//);
    assert.match(io, /updateTourAction/);
    assert.match(io, /finalizeFlatEditTourLoad/);
  });
});
