/**
 * Denali confirm dialog — admin pattern closure
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const WEB_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function readSource(relativePath: string): string {
  return readFileSync(join(WEB_ROOT, relativePath), "utf8");
}

describe("denali-confirm-dialog.spec.ts", () => {
  it("DenaliConfirmDialog uses Radix Dialog + data-denali-surface card", () => {
    const source = readSource("src/admin/patterns/denali-confirm-dialog.tsx");
    assert.match(source, /data-denali-surface="card"/);
    assert.match(source, /DialogDescription/);
    assert.match(source, /confirmVariant/);
  });

  it("create tour uses Denali confirm instead of window.confirm", () => {
    const wizard = readSource("app/tours/new/denali-create-tour-wizard-client.tsx");
    assert.doesNotMatch(wizard, /window\.confirm/);
    assert.match(wizard, /useDenaliWizardClearDraft/);
    assert.match(wizard, /clearDraftConfirmDialog/);
  });
});
