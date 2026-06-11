/**
 * Phase 9.8 — phase-9 contract closure (route parity inventory)
 * Authority: docs/phase-9/subphases/9.8-operator-dod-gate.md · OPERATOR-PRODUCT-SCOPE.md
 */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import {
  listOperatorRouteParityByStatus,
  OPERATOR_ROUTE_PARITY_INVENTORY,
} from "../src/features/operator/operator-route-parity-inventory";

const webAppRoot = join(fileURLToPath(new URL("..", import.meta.url)), "app");

function trunkPageExists(trunkAppPath: string): boolean {
  return existsSync(join(webAppRoot, trunkAppPath));
}

describe("phase-9.contract.spec.ts — Phase 9.8", () => {
  it("P9-8-C01 parity inventory has unique ids", () => {
    const ids = OPERATOR_ROUTE_PARITY_INVENTORY.map((entry) => entry.id);
    assert.equal(new Set(ids).size, ids.length);
    assert.ok(ids.length >= 20);
  });

  it("P9-8-C02 landed routes exist on trunk filesystem", () => {
    const missing = listOperatorRouteParityByStatus("landed").filter(
      (entry) => !trunkPageExists(entry.trunkAppPath)
    );
    assert.deepEqual(
      missing.map((entry) => entry.id),
      [],
      `Missing landed routes: ${missing.map((entry) => entry.trunkAppPath).join(", ")}`
    );
  });

  it("P9-8-C03 alias routes have trunk redirect/page artifacts", () => {
    const missing = listOperatorRouteParityByStatus("alias").filter(
      (entry) => !trunkPageExists(entry.trunkAppPath)
    );
    assert.deepEqual(
      missing.map((entry) => entry.id),
      [],
      `Missing alias routes: ${missing.map((entry) => entry.trunkAppPath).join(", ")}`
    );
    for (const entry of listOperatorRouteParityByStatus("alias")) {
      assert.ok(entry.aliasTarget !== undefined && entry.aliasTarget.length > 0, entry.id);
    }
  });

  it("P9-8-C04 deferred routes are explicitly tracked pre-9.8 gate", () => {
    const deferred = listOperatorRouteParityByStatus("deferred");
    assert.deepEqual(deferred.map((entry) => entry.id), []);
  });
});
