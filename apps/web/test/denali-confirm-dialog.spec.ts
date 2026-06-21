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
    const hook = readSource("src/wizard/use-denali-create-tour-wizard.ts");
    const chrome = readSource("src/wizard/create-tour-wizard-chrome.tsx");
    const clearDraftHook = readSource("src/draft/use-denali-wizard-clear-draft.tsx");
    assert.doesNotMatch(wizard, /window\.confirm/);
    assert.doesNotMatch(hook, /window\.confirm/);
    assert.match(hook, /useDenaliWizardClearDraft/);
    assert.match(chrome, /clearDraftConfirmDialog/);
    assert.match(clearDraftHook, /DenaliConfirmDialog/);
  });
});
