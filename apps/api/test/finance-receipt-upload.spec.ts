/**
 * FC-5 — operator receipt upload route wiring (static).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { FINANCE_HTTP_ROUTE_MANIFEST } from "@app-tour/finance-http";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

describe("finance-receipt-upload.spec.ts — FC-5", () => {
  it("API-FC5-01 manifest includes POST /finance/receipts/upload", () => {
    const route = FINANCE_HTTP_ROUTE_MANIFEST.find(
      (entry) => entry.method === "POST" && entry.path === "/finance/receipts/upload"
    );
    assert.ok(route);
  });

  it("API-FC5-02 handler delegates to host uploadOperatorReceiptProof", () => {
    const routes = readFileSync(
      resolve(REPO_ROOT, "packages/finance-http/src/finance.routes.ts"),
      "utf8"
    );
    assert.match(routes, /handleFinanceReceiptUpload/);
    assert.match(routes, /uploadOperatorReceiptProof/);
  });

  it("WEB-FC5-01 BFF upload route proxies binary body", () => {
    const bff = readFileSync(
      resolve(REPO_ROOT, "apps/web/src/finance/proxy-finance-receipt-upload.server.ts"),
      "utf8"
    );
    assert.match(bff, /\/finance\/receipts\/upload/);
    assert.match(bff, /arrayBuffer/);
  });
});
