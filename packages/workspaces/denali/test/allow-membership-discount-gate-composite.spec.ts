/**
 * Discount MVP 2A.1 — allowMembershipDiscount pricing composite wiring (GATE-COMP-01..04).
 * Authority: docs/workspaces/denali/commercial-quote-snapshot.mdoc (DEC-CQ-011)
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import {
  DENALI_COMPOSITE_DEPENDENTS_BY_ANCHOR,
  DENALI_COMPOSITE_DEPENDENT_PATHS,
  shouldRenderDenaliRegistryField,
} from "../src/composites/denali-composite-anchors.ts";
import {
  resolveDenaliCompositeRendererId,
  resolveDenaliFieldRenderer,
} from "../src/composites/denali-composite-registry.ts";
import { resolveDenaliAllowMembershipDiscount } from "../src/finance/resolve-denali-allow-membership-discount.ts";
import {
  findDenaliFieldDefinition,
  resolveDenaliCompositeParentAnchor,
} from "../src/settings/denali-wizard-template-catalog-meta.ts";
import {
  isDenaliCompositeDependentAllowedInTemplateStep,
  resolveDenaliCompositeAnchorForDependent,
} from "../src/settings/denali-wizard-template-composite-prefill.ts";
import { buildDenaliTourCreateDefaultValues } from "../src/schemas/denaliCore.schema.ts";
import { evaluateDenaliContextualVisibility } from "../src/rules/denaliContextualRules.ts";
import { buildDenaliFullWizardTemplatePayload } from "../src/settings/denaliFullWizardTemplate.ts";

const GATE_PATH = "pricing.allowMembershipDiscount" as const;
const ANCHOR_PATH = "pricing.requiresPayment" as const;
const SRC_ROOT = join(dirname(fileURLToPath(import.meta.url)), "../src");

describe("allow-membership-discount-gate-composite.spec.ts — Discount MVP 2A.1", () => {
  it("GATE-COMP-01: composite surface owns the field (anchor → denali.pricing-payment)", () => {
    const dependents = DENALI_COMPOSITE_DEPENDENTS_BY_ANCHOR[ANCHOR_PATH] ?? [];
    assert.ok(dependents.includes(GATE_PATH));
    assert.ok(DENALI_COMPOSITE_DEPENDENT_PATHS.has(GATE_PATH));

    const anchor = findDenaliFieldDefinition(ANCHOR_PATH);
    assert.ok(anchor);
    assert.equal(resolveDenaliCompositeRendererId(anchor), "denali.pricing-payment");

    const pricingUi = readFileSync(
      join(SRC_ROOT, "ui/fields/denali-pricing-payment-field.tsx"),
      "utf8"
    );
    assert.match(pricingUi, /pricing\.allowMembershipDiscount/);
    assert.match(pricingUi, /denali-pricing-allow-membership-discount/);
  });

  it("GATE-COMP-02: standalone duplicate boolean renderer prevented", () => {
    const def = findDenaliFieldDefinition(GATE_PATH);
    assert.ok(def);
    assert.equal(shouldRenderDenaliRegistryField(def), false);
    assert.equal(resolveDenaliFieldRenderer(def), null);
    assert.equal(resolveDenaliCompositeRendererId(def), null);
  });

  it("GATE-COMP-03: requiresPayment dependency — visible when paid, hidden when unpaid", () => {
    const def = findDenaliFieldDefinition(GATE_PATH);
    assert.ok(def);
    assert.deepEqual(def.contextualVisibility, {
      kind: "whenTruthy",
      watchCanonical: ANCHOR_PATH,
    });
    assert.equal(resolveDenaliCompositeParentAnchor(GATE_PATH), ANCHOR_PATH);
    assert.equal(resolveDenaliCompositeAnchorForDependent(GATE_PATH), ANCHOR_PATH);

    const paid = buildDenaliTourCreateDefaultValues();
    paid.basicInfo.tourType = "mountain_day";
    paid.pricingPayment.requiresPayment = true;
    assert.equal(evaluateDenaliContextualVisibility(GATE_PATH, paid), true);

    const unpaid = buildDenaliTourCreateDefaultValues();
    unpaid.basicInfo.tourType = "mountain_day";
    unpaid.pricingPayment.requiresPayment = false;
    assert.equal(evaluateDenaliContextualVisibility(GATE_PATH, unpaid), false);

    // Stored gate may remain true while unpaid — Finance free-collection still wins; Catalog keeps value.
    assert.equal(
      resolveDenaliAllowMembershipDiscount({
        data: {
          pricing: {
            requiresPayment: false,
            allowMembershipDiscount: "true",
          },
        },
      }),
      true
    );
  });

  it("GATE-COMP-04: full template apply does not duplicate gate as a step field", () => {
    const payload = buildDenaliFullWizardTemplatePayload();
    const pricingStep = payload.steps.find((step) => step.stepId === "denali_pricing");
    assert.ok(pricingStep);

    const stepPaths = pricingStep.fields.map((field) => field.canonicalPath);
    assert.ok(stepPaths.includes(ANCHOR_PATH));
    assert.equal(stepPaths.includes(GATE_PATH), false);

    assert.equal(
      isDenaliCompositeDependentAllowedInTemplateStep(pricingStep.fields, GATE_PATH),
      true
    );

    // Sibling pricing dependents also stay off the template step list (anchor-only).
    for (const dependent of [
      "pricing.prepaymentEnabled",
      "pricing.basePricePerPerson",
      "pricing.includesTourInsurance",
      GATE_PATH,
    ]) {
      assert.equal(stepPaths.includes(dependent), false);
    }
  });

  it("legacy missing field remains fail-closed", () => {
    assert.equal(
      resolveDenaliAllowMembershipDiscount({
        data: { pricing: { requiresPayment: true, basePricePerPerson: 1_000_000 } },
      }),
      false
    );
  });
});
