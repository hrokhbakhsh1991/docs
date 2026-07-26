/**
 * Denali operator starter-shape create bridge (Phase 9.3 / 11.0)
 * Authority: docs/phase-9/appendices/tours-operator-api-dispatch-addendum.md
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  enrichStarterDocumentForDenaliOperatorList,
  isStarterShapedDenaliCreateBody,
  shouldUseStarterValidationForDenaliCreate,
} from "../src/tours/bridge-denali-operator-create-body";
import { validateCanonicalBeforePersistSync } from "../src/tours/canonical-validation-sync";
import { OPERATOR_SMOKE_TENANT_ID } from "../src/settings/seed-operator-smoke-catalog";
import { createCanonicalDocument } from "@app-tour/workspace-sdk";

describe("denali-operator-create-bridge.spec.ts", () => {
  it("BRIDGE-01 starter validation path enriches denali list projection fields", async () => {
    assert.equal(
      shouldUseStarterValidationForDenaliCreate("denali", OPERATOR_SMOKE_TENANT_ID, {
        data: {
          basics: { title: "Desert trek" },
          details: { summary: "Sand dunes" },
        },
      }),
      true
    );

    const document = enrichStarterDocumentForDenaliOperatorList(
      createCanonicalDocument({
        schemaVersion: 1,
        roots: ["basics", "details"],
        data: {
          basics: { title: "Desert trek" },
          details: { summary: "Sand dunes" },
        },
      })
    );
    assert.equal(document.data.title, "Desert trek");
    assert.equal(
      (document.data.program as { shortDescription?: string }).shortDescription,
      "Sand dunes"
    );
  });

  it("BRIDGE-02 starter-shaped ingress validates for operator smoke tenant", async () => {
    const document = await validateCanonicalBeforePersistSync({
      tenantId: OPERATOR_SMOKE_TENANT_ID,
      workspaceType: "denali",
      body: {
        data: {
          basics: { title: "Operator list seed" },
          details: { summary: "Memory spec tour" },
          category: "mountain_day",
        },
      },
    });
    assert.equal(document.data.title, "Operator list seed");
    assert.equal(document.data.basics?.title, "Operator list seed");
  });

  it("BRIDGE-03 title-only ingress skips starter validation bridge", async () => {
    assert.equal(
      isStarterShapedDenaliCreateBody({
        data: { basics: { title: "Incomplete" } },
      }),
      true
    );
    assert.equal(
      shouldUseStarterValidationForDenaliCreate("denali", OPERATOR_SMOKE_TENANT_ID, {
        data: { basics: { title: "Incomplete" } },
      }),
      false
    );
    await assert.rejects(() =>
        validateCanonicalBeforePersistSync({
          tenantId: OPERATOR_SMOKE_TENANT_ID,
          workspaceType: "denali",
          body: {
            data: { basics: { title: "Incomplete" } },
          },
        }),
      /CANONICAL_VALIDATION_FAILED/
    );
  });
});
