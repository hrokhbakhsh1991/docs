import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import {
  getDenaliWorkspacePlugin,
  projectDenaliWizardFormToCanonicalIngressData,
} from "../../packages/workspaces/denali/dist/index.js";
import { getStarterWorkspacePlugin } from "../../packages/workspaces/starter/dist/index.js";
import { getUrbanWorkspacePlugin } from "../../packages/workspaces/urban/dist/index.js";
import { createCanonicalDocument } from "../../packages/workspace-sdk/dist/canonical/canonical-document.js";
import {
  ensureDenaliFrozenTemplateSteps,
  isDenaliFrozenTemplateCanonicalPath,
  listDenaliFrozenTemplateCanonicalPaths,
} from "../../packages/workspaces/denali/src/wizard/ensure-tour-kind-template-field.ts";
import { runValidationModePublishGate } from "../../apps/api/src/tours/resolve-validation-mode.ts";
import { assertGoldenParity, fixturePath } from "./lib/golden-harness.mjs";

const DENALI_GOLDEN_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../packages/workspaces/denali/test/fixtures/golden"
);
const URBAN_GOLDEN_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../packages/workspaces/urban/test/fixtures/golden"
);

function loadDenaliGoldenForm(filename) {
  const raw = JSON.parse(readFileSync(join(DENALI_GOLDEN_DIR, filename), "utf8"));
  const { _templateOverlay: _ignored, ...form } = raw;
  return form;
}

function loadUrbanGoldenDocument(filename) {
  return JSON.parse(readFileSync(join(URBAN_GOLDEN_DIR, filename), "utf8"));
}

describe("wizard frozen parity goldens (CW0-07)", () => {
  it("Denali frozen canonical path catalog is stable", () => {
    assertGoldenParity({
      id: "CW0-07-denali-frozen-paths",
      fixturePath: fixturePath("wizard/denali-frozen-paths.json"),
      run: (input) => {
        const typed = /** @type {{
          readonly pathsToCheck: readonly string[];
        }} */ (input);
        return {
          frozenPaths: [...listDenaliFrozenTemplateCanonicalPaths()],
          frozenChecks: typed.pathsToCheck.map((path) => ({
            path,
            frozen: isDenaliFrozenTemplateCanonicalPath(path),
          })),
        };
      },
    });
  });

  it("Denali frozen template injection preserves catalog-critical fields", () => {
    assertGoldenParity({
      id: "CW0-07-denali-frozen-template-inject",
      fixturePath: fixturePath("wizard/denali-frozen-template-inject.json"),
      run: (input) => {
        const typed = /** @type {{
          readonly steps: readonly {
            readonly stepId: string;
            readonly enabled: boolean;
            readonly fields: readonly { readonly canonicalPath: string }[];
          }[];
        }} */ (input);
        const steps = ensureDenaliFrozenTemplateSteps(typed.steps);
        return {
          steps: steps.map((step) => ({
            stepId: step.stepId,
            fields: step.fields.map((field) => field.canonicalPath),
          })),
        };
      },
    });
  });

  it("Denali draft-vs-publish publish gate matches tour-minimal active golden", () => {
    assertGoldenParity({
      id: "CW0-07-denali-draft-vs-publish-gate",
      fixturePath: fixturePath("wizard/denali-draft-vs-publish-gate.json"),
      run: (input) => {
        const typed = /** @type {{
          readonly goldenFormFile: string;
          readonly publishStatus: string;
        }} */ (input);
        const plugin = getDenaliWorkspacePlugin();
        const form = loadDenaliGoldenForm(typed.goldenFormFile);
        form.basicInfo.publishStatus = typed.publishStatus;
        const document = createCanonicalDocument({
          schemaVersion: 1,
          roots: [...plugin.wizard.roots],
          data: projectDenaliWizardFormToCanonicalIngressData(form),
        });
        return {
          draftGate: runValidationModePublishGate(plugin, document, "draft"),
          publishGate: runValidationModePublishGate(plugin, document, "publish"),
        };
      },
    });
  });

  it("Urban and starter minimal wizard paths stay stable", () => {
    assertGoldenParity({
      id: "CW0-07-minimal-workspace-wizard",
      fixturePath: fixturePath("wizard/minimal-workspace-wizard.json"),
      run: (input) => {
        const typed = /** @type {{
          readonly urbanGoldenFile: string;
          readonly starterDraft: Record<string, unknown>;
          readonly starterOpenStatus: string;
        }} */ (input);

        const urbanPlugin = getUrbanWorkspacePlugin();
        const urbanGolden = loadUrbanGoldenDocument(typed.urbanGoldenFile);
        const urbanPublished = structuredClone(urbanGolden);
        urbanPublished.data.tour.publishStatus = "published";

        const starterPlugin = getStarterWorkspacePlugin();
        const starterOpen = structuredClone(typed.starterDraft);
        const starterDetails = /** @type {Record<string, unknown>} */ (
          starterOpen.details ?? {}
        );
        starterOpen.details = { ...starterDetails, status: typed.starterOpenStatus };

        return {
          urban: {
            draftGate: runValidationModePublishGate(
              urbanPlugin,
              createCanonicalDocument(urbanGolden),
              "draft"
            ),
            publishGate: runValidationModePublishGate(
              urbanPlugin,
              createCanonicalDocument(urbanPublished),
              "publish"
            ),
            draftSync: urbanPlugin.wizardHost?.validateDraftSync?.({
              plugin: urbanPlugin,
              draft: { data: urbanGolden.data },
              rulesModule: null,
              tenantId: "cw0-07-parity-tenant",
            }),
          },
          starter: {
            draftGate: runValidationModePublishGate(
              starterPlugin,
              createCanonicalDocument({
                schemaVersion: 1,
                roots: [...starterPlugin.wizard.roots],
                data: typed.starterDraft,
              }),
              "draft"
            ),
            publishGate: runValidationModePublishGate(
              starterPlugin,
              createCanonicalDocument({
                schemaVersion: 1,
                roots: [...starterPlugin.wizard.roots],
                data: starterOpen,
              }),
              "publish"
            ),
            draftSync: starterPlugin.wizardHost?.validateDraftSync?.({
              plugin: starterPlugin,
              draft: { data: typed.starterDraft },
              rulesModule: null,
              tenantId: "cw0-07-parity-tenant",
            }),
          },
        };
      },
    });
  });
});
