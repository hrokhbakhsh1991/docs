/**
 * FC-3 — tour-level finance reporting (by-tour aggregate + tourId list scope).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import { FINANCE_HTTP_ROUTE_MANIFEST } from "@app-tour/finance-http";
import { filterRowsByTourId } from "@app-tour/finance-core";
import { createRequestListener } from "../src/app";
import { installHttpTestClient } from "./http-test-client";
import { installMemoryStorageDriverForDescribe } from "./test-helpers";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

installMemoryStorageDriverForDescribe();

describe("finance-reports-by-tour.spec.ts — FC-3", () => {
  const client = installHttpTestClient(() => createRequestListener());

  it("CP-FC3-01 GET /finance/reports/by-tour is handled (not 404)", async () => {
    const response = await client.requestJson("GET", "/finance/reports/by-tour", {
      headers: { "x-tenant-id": "00000000-0000-4000-8000-000000000001" },
    });
    assert.notEqual(response.status, 404);
  });

  it("CP-FC3-02 manifest includes by-tour read route", async () => {
    assert.ok(
      FINANCE_HTTP_ROUTE_MANIFEST.some(
        (route) => route.method === "GET" && route.path === "/finance/reports/by-tour"
      )
    );
  });

  it("CP-FC3-03 PrismaFinanceRepository exposes listPaymentsByTourAggregate", async () => {
    const src = readFileSync(
      resolve(REPO_ROOT, "apps/api/src/workspace-finance/infrastructure/prisma-finance.repository.ts"),
      "utf8"
    );
    assert.match(src, /listPaymentsByTourAggregate/);
    assert.match(src, /operator_registrations/);
  });

  it("CP-FC3-04 filterRowsByTourId keeps rows matching tour context", async () => {
    const rows = [
      { registrationId: "reg-a", amount: "1" },
      { registrationId: "reg-b", amount: "2" },
    ];
    const contexts = new Map([
      [
        "reg-a",
        {
          registrationId: "reg-a",
          tourId: "tour-1",
          tourTitle: "North",
          memberDisplayName: "Ali",
        },
      ],
      [
        "reg-b",
        {
          registrationId: "reg-b",
          tourId: "tour-2",
          tourTitle: "South",
          memberDisplayName: "Sara",
        },
      ],
    ]);
    assert.deepEqual(filterRowsByTourId(rows, undefined, contexts), rows);
    assert.deepEqual(filterRowsByTourId(rows, "tour-1", contexts), [rows[0]]);
    assert.deepEqual(filterRowsByTourId(rows, "missing", contexts), []);
  });
});
