import { describe, it } from "node:test";

import { createCanonicalDocument } from "../../packages/workspace-sdk/src/canonical/canonical-document.ts";
import { detectWorkspaceTourPublishTransition } from "../../packages/workspace-sdk/src/http/detect-workspace-tour-publish-transition.ts";
import { isWorkspaceLifecycleTransitionAllowed } from "../../packages/workspace-sdk/src/plugin/workspace-lifecycle-transition.ts";
import { STARTER_LIFECYCLE } from "../../packages/workspace-sdk/src/reference/starter-plugin-core.ts";

import { detectDenaliTourPublishTransition } from "../../packages/workspaces/denali/src/tours/denali-tour-publish-transition.ts";
import { isHarborTourPublished } from "../../packages/workspaces/harbor/src/catalog/to-harbor-catalog-card.ts";
import { detectUrbanTourPublishTransition } from "../../packages/workspaces/urban/src/tours/urban-tour-publish-transition.ts";
import { assertGoldenParity, fixturePath } from "./lib/golden-harness.mjs";

function detectHarborTourPublishTransition(beforeData, afterData) {
  const before = createCanonicalDocument({
    schemaVersion: 1,
    roots: Object.keys(beforeData),
    data: beforeData,
  });
  const after = createCanonicalDocument({
    schemaVersion: 1,
    roots: Object.keys(afterData),
    data: afterData,
  });
  return detectWorkspaceTourPublishTransition(
    isHarborTourPublished(before),
    isHarborTourPublished(after)
  );
}

function runPublishTransitionCase(caseRow) {
  switch (caseRow.workspace) {
    case "denali":
      return {
        transition: detectDenaliTourPublishTransition(caseRow.before, caseRow.after),
      };
    case "urban":
      return {
        transition: detectUrbanTourPublishTransition(caseRow.before, caseRow.after),
      };
    case "harbor":
      return {
        transition: detectHarborTourPublishTransition(caseRow.before, caseRow.after),
      };
    case "starter":
      if (caseRow.fromStatus !== undefined && caseRow.toStatus !== undefined) {
        return {
          lifecycleAllowed: isWorkspaceLifecycleTransitionAllowed(
            STARTER_LIFECYCLE,
            caseRow.fromStatus,
            caseRow.toStatus
          ),
        };
      }
      return {
        transition: detectWorkspaceTourPublishTransition(
          caseRow.wasPublished,
          caseRow.isPublished
        ),
      };
    default:
      throw new Error(`unsupported workspace ${caseRow.workspace}`);
  }
}

describe("publish transition parity goldens (CW0-02)", () => {
  it("preserves Denali active/draft, Urban published, Harbor published, Starter DRAFT/OPEN semantics", () => {
    assertGoldenParity({
      id: "CW0-02-publish-transitions",
      fixturePath: fixturePath("publish-transition/workspace-publish-transitions.json"),
      run: (input) => {
        const typed = /** @type {{
          readonly cases: readonly Record<string, unknown>[];
        }} */ (input);
        return {
          results: typed.cases.map((caseRow) => {
            const row = /** @type {Record<string, unknown>} */ (caseRow);
            const outcome = runPublishTransitionCase(row);
            return {
              workspace: row.workspace,
              label: row.label,
              ...outcome,
            };
          }),
        };
      },
    });
  });
});
