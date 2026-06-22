/**
 * P5-C-N-008 — Denali offline_receipt preservation (PC-07)
 * @see docs/phase-18/platform-workspace-commerce.mdoc
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

describe("denali-offline-receipt-unchanged (P5-C PC-07)", () => {
  it("PC-07 denali core schema keeps offline_receipt paymentMode default", () => {
    const schema = readFileSync(
      join(repoRoot, "packages/workspaces/denali/src/schemas/denaliCore.schema.ts"),
      "utf8"
    );
    assert.match(schema, /paymentMode: "offline_receipt"/);
  });

  it("PC-07 finance receipt routes remain on manifest", () => {
    const routes = readFileSync(
      join(repoRoot, "packages/workspaces/denali/src/http/routes-manifest.ts"),
      "utf8"
    );
    assert.match(routes, /POST.*\/finance\/receipts/);
    assert.match(routes, /PATCH.*\/finance\/receipts/);
  });

  it("PC-07 denali frozen commerce resolver stays offline_receipt", () => {
    const resolver = readFileSync(
      join(repoRoot, "apps/api/src/workspace-metadata/resolve-workspace-commerce-for-tenant.ts"),
      "utf8"
    );
    assert.match(resolver, /DENALI_FROZEN_COMMERCE_CONFIG/);
    assert.match(resolver, /paymentMode: "offline_receipt"/);
  });

  it("PC-07 tour create apply path forces denali offline_receipt", () => {
    const apply = readFileSync(
      join(repoRoot, "apps/api/src/tours/apply-workspace-commerce-create-default.ts"),
      "utf8"
    );
    assert.match(apply, /DENALI_FROZEN_COMMERCE_CONFIG\.paymentMode/);
  });
});
