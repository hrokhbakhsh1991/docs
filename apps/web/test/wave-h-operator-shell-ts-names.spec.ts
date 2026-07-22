import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const WEB_ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");

const FORBIDDEN = [
  "resolveDenaliDraftConflictStrategy",
  "createDenaliDraftOnPushSuccess",
  "CreateTourWizardDenaliHeader",
  "DenaliDraftSyncChrome",
  "showDenaliFullTemplate",
] as const;

const REQUIRED = [
  "resolveOperatorDraftConflictStrategy",
  "createOperatorDraftOnPushSuccess",
  "CreateTourWizardHeader",
  "OperatorDraftSyncChrome",
  "showExtendedWizardTemplate",
] as const;

const SURFACES = [
  "src/draft/draft-unification-v3-options.ts",
  "src/wizard/wizard-draft-shell.ts",
  "src/wizard/create-tour-wizard-chrome.tsx",
  "src/wizard/use-create-tour-wizard.ts",
  "src/wizard/use-flat-edit-page.ts",
  "app/tours/new/create-tour-wizard-client.tsx",
  "app/(app)/settings/tour-wizard-template/wizard-template-client.tsx",
] as const;

describe("Wave H.o — operator shell TypeScript names", () => {
  it("shell surfaces use operator names and drop Denali helper brands", () => {
    const corpus = SURFACES.map((rel) => readFileSync(join(WEB_ROOT, rel), "utf8")).join("\n");
    for (const name of FORBIDDEN) {
      assert.equal(corpus.includes(name), false, `forbidden leftover: ${name}`);
    }
    for (const name of REQUIRED) {
      assert.match(corpus, new RegExp(name));
    }
  });
});
