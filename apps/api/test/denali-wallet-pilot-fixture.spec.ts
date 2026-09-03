/**
 * Phase 2 — Denali Wallet pilot fixture contract (seed SoT).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  DENALI_WALLET_PILOT_SUBDOMAIN,
  DENALI_WALLET_PILOT_TENANT_ID,
} from "@app-tour/workspace-denali";

import { DENALI_WALLET_PILOT } from "./fixtures/denali-wallet-pilot-tenant";

const apiRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("denali-wallet-pilot-fixture.spec.ts", () => {
  it("fixture aligns with denali package pilot constants", () => {
    assert.equal(DENALI_WALLET_PILOT.tenantId, DENALI_WALLET_PILOT_TENANT_ID);
    assert.equal(DENALI_WALLET_PILOT.subdomain, DENALI_WALLET_PILOT_SUBDOMAIN);
    assert.equal(DENALI_WALLET_PILOT.currency, "IRR");
  });

  it("seed script provisions entitled member portalModuleGrants only", () => {
    const source = readFileSync(join(apiRoot, "scripts/seed-denali-wallet-pilot.ts"), "utf8");
    assert.match(source, /seedDenaliWalletPilotTenant/);
    assert.match(source, /portalModuleGrants:\s*\["wallet"\]/);
    assert.doesNotMatch(source, /seedDenaliSmokeTenant/);
  });

  it("provisioning pilot method does not touch club smoke tenant", () => {
    const source = readFileSync(join(apiRoot, "src/internal/provisioning.service.ts"), "utf8");
    assert.match(source, /seedDenaliWalletPilotTenant/);
    const pilotBlock = source.slice(
      source.indexOf("seedDenaliWalletPilotTenant"),
      source.indexOf("seedOperatorSmokeTenant")
    );
    assert.match(pilotBlock, /enabledModules:\s*\["wallet"\]/);
    assert.match(pilotBlock, /currency:\s*"IRR"/);
    assert.doesNotMatch(pilotBlock, /DENALI_SMOKE_TENANT_ID/);
  });
});
