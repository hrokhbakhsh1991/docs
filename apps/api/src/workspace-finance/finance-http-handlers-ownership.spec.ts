/**
 * Phase 1.4 Commit 2 — finance HTTP handler ownership proofs.
 * FIN-P1.4-C2-01 Denali finance.routes is re-export only
 * FIN-P1.4-C2-02 Codegen loads finance handlers from @app-tour/finance-http
 * FIN-P1.4-C2-03 Finance route paths unchanged in FINANCE_HTTP_ROUTE_MANIFEST
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import { FINANCE_HTTP_ROUTE_MANIFEST } from "@app-tour/finance-http";
import { FINANCE_HTTP_ROUTE_MANIFEST as DENALI_FINANCE_HTTP_ROUTE_MANIFEST } from "@app-tour/workspace-denali/host/http";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");

describe("finance-http-handlers-ownership.spec.ts — Phase 1.4 C2", () => {
  it("FIN-P1.4-C2-01 Denali finance.routes.ts is a re-export façade only", () => {
    const denaliRoutes = readFileSync(
      resolve(REPO_ROOT, "packages/workspaces/denali/src/http/finance.routes.ts"),
      "utf8"
    );
    assert.match(denaliRoutes, /@app-tour\/finance-http/);
    assert.doesNotMatch(denaliRoutes, /getDenaliFinanceHttpHost|getFinanceHttpHost/);
    assert.doesNotMatch(denaliRoutes, /parseCreateManualPaymentBody/);
    assert.doesNotMatch(denaliRoutes, /runWithHttpRequestContext/);

    const owned = readFileSync(
      resolve(REPO_ROOT, "packages/finance-http/src/finance.routes.ts"),
      "utf8"
    );
    assert.match(owned, /export async function handleFinanceSummary/);
    assert.match(owned, /getFinanceHttpHost/);
  });

  it("FIN-P1.4-C2-02 generated loaders import finance handlers from finance-http", () => {
    const loaders = readFileSync(
      resolve(REPO_ROOT, "apps/api/src/http/workspace-http-handler-loaders.generated.ts"),
      "utf8"
    );
    assert.match(loaders, /@app-tour\/finance-http/);
    assert.match(loaders, /handleFinanceSummary/);
    // Catalog remains Denali-packaged
    assert.match(loaders, /@app-tour\/workspace-denali\/host\/http/);
    assert.match(loaders, /handleGetDenaliCatalog/);
  });

  it("FIN-P1.4-C2-03 finance route path inventory unchanged (SoT === Denali re-export)", () => {
    assert.deepEqual([...FINANCE_HTTP_ROUTE_MANIFEST], [...DENALI_FINANCE_HTTP_ROUTE_MANIFEST]);
    const paths = FINANCE_HTTP_ROUTE_MANIFEST.map((r) => `${r.method} ${r.path}`).sort();
    assert.deepEqual(paths, [
      "GET /finance/invoices/:registrationId",
      "GET /finance/payments",
      "GET /finance/prepayments",
      "GET /finance/prepayments/booking-sync-degraded",
      "GET /finance/receipts/:receiptId/url",
      "GET /finance/receipts/pending",
      "GET /finance/reports/ledger-events",
      "GET /finance/reports/open-payments",
      "GET /finance/reports/summary",
      "GET /finance/schedules",
      "GET /finance/schedules/:registrationId",
      "PATCH /finance/receipts/:receiptId/review",
      "POST /finance/payments/manual",
      "POST /finance/prepayments",
      "POST /finance/prepayments/booking-sync-retry",
      "POST /finance/receipts",
      "POST /finance/schedules/generate",
    ]);
  });
});
