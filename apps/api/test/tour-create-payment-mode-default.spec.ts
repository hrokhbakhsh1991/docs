/**
 * P5-C-N-005 — tour create applies workspace commerce paymentMode default
 * @see docs/phase-18/platform-workspace-commerce.mdoc
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { WorkspaceCommerceConfig } from "@app-tour/workspace-sdk/metadata";

import {
  applyWorkspaceCommerceDefaultToCreateBody,
  applyWorkspaceCommercePaymentModeToCreateData,
} from "../src/tours/apply-workspace-commerce-create-default.ts";
import { DENALI_FROZEN_COMMERCE_CONFIG } from "../src/workspace-metadata/resolve-workspace-commerce-for-tenant.ts";

const GATEWAY_COMMERCE: WorkspaceCommerceConfig = {
  paymentMode: "gateway",
  gatewayProvider: "zibal",
  currency: "IRR",
};

describe("tour-create-payment-mode-default (P5-C API-03..04)", () => {
  it("API-03 starter create merges missing pricing.paymentMode from workspace commerce", () => {
    const body = applyWorkspaceCommerceDefaultToCreateBody(
      "starter",
      {
        data: {
          basics: { title: "Starter tour" },
          details: { summary: "ok" },
        },
      },
      GATEWAY_COMMERCE
    );

    const pricing = (body.data as Record<string, unknown>).pricing as { paymentMode?: string };
    assert.equal(pricing.paymentMode, "gateway");
    assert.deepEqual(body.roots, ["basics", "details", "pricing"]);
  });

  it("API-03 does not override explicit pricing.paymentMode on non-Denali create", () => {
    const body = applyWorkspaceCommerceDefaultToCreateBody(
      "starter",
      {
        data: {
          basics: { title: "Starter tour" },
          pricing: { paymentMode: "offline_receipt" },
        },
      },
      GATEWAY_COMMERCE
    );

    const pricing = (body.data as Record<string, unknown>).pricing as { paymentMode?: string };
    assert.equal(pricing.paymentMode, "offline_receipt");
  });

  it("API-04 denali create forces offline_receipt even when commerce config differs", () => {
    const data = applyWorkspaceCommercePaymentModeToCreateData(
      "denali",
      {
        basics: { title: "Denali tour" },
        pricing: { paymentMode: "gateway" },
      },
      GATEWAY_COMMERCE
    );

    const pricing = data.pricing as { paymentMode?: string };
    assert.equal(pricing.paymentMode, DENALI_FROZEN_COMMERCE_CONFIG.paymentMode);
  });

  it("API-05 keeps prepayment policy when starter ingress injects missing paymentMode", () => {
    const body = applyWorkspaceCommerceDefaultToCreateBody(
      "starter",
      {
        data: {
          basics: { title: "Starter prepayment tour" },
          pricing: {
            prepaymentEnabled: true,
            prepaymentPercent: 30,
          },
        },
      },
      GATEWAY_COMMERCE
    );

    const pricing = (body.data as Record<string, unknown>).pricing as {
      paymentMode?: string;
      prepaymentEnabled?: boolean;
      prepaymentPercent?: number;
    };
    assert.equal(pricing.paymentMode, "gateway");
    assert.equal(pricing.prepaymentEnabled, true);
    assert.equal(pricing.prepaymentPercent, 30);
  });

  it("API-06 keeps denali prepayment fields while freezing paymentMode", () => {
    const data = applyWorkspaceCommercePaymentModeToCreateData(
      "denali",
      {
        basics: { title: "Denali prepayment tour" },
        pricing: {
          paymentMode: "gateway",
          prepaymentEnabled: true,
          prepaymentPercent: 50,
        },
      },
      GATEWAY_COMMERCE
    );

    const pricing = data.pricing as {
      paymentMode?: string;
      prepaymentEnabled?: boolean;
      prepaymentPercent?: number;
    };
    assert.equal(pricing.paymentMode, DENALI_FROZEN_COMMERCE_CONFIG.paymentMode);
    assert.equal(pricing.prepaymentEnabled, true);
    assert.equal(pricing.prepaymentPercent, 50);
  });
});
