/**
 * FC-2 — host obligation wiring + invoice compile integration.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import { compileRegistrationInvoice } from "@app-tour/finance-core";
import { createFinanceObligationPort } from "../src/workspace-finance/finance-obligation.factory.ts";
import { RegistrationFinanceObligationAdapter } from "../src/workspace-finance/infrastructure/registration-finance-obligation.adapter.ts";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

describe("finance-obligation-denali.spec.ts — FC-2", () => {
  it("CP-FC2-01 compileRegistrationInvoice prefers obligation over payment-sum fallback", () => {
    const invoice = compileRegistrationInvoice({
      registrationId: "reg-1",
      currency: "IRR",
      prepaymentMinor: "0",
      paidPaymentsMinor: "1000000",
      paymentAmountsMinor: ["1000000"],
      scheduleAmountsMinor: [],
      obligationMinor: "5000000",
    });
    assert.equal(invoice.invoiceTotalMinor, "5000000");
    assert.equal(invoice.balanceDueMinor, "4000000");
  });

  it("CP-FC2-02 lazy finance factory resolves obligation adapter via codegen binding", async () => {
    const port = await createFinanceObligationPort("denali");
    assert.ok(port instanceof RegistrationFinanceObligationAdapter);
    assert.ok((await createFinanceObligationPort("finance-ws5")) !== port);
  });

  it("CP-FC2-04 Denali adapter exposes trip line as discountable base", async () => {
    const booking = {
      tourId: "tour-1",
      partySize: 1,
      registrationIntake: { transport: { kind: "primary" } },
    };
    const tour = {
      canonical: {
        data: {
          pricing: { basePricePerPerson: 1_000_000, paymentMode: "offline_receipt" },
          transport: { mode: "bus", transportCost: 300_000 },
        },
        schemaVersion: 1,
      },
    };
    const adapter = new RegistrationFinanceObligationAdapter(
      {
        async getById(registrationId: string, tenantId: string) {
          assert.equal(registrationId, "reg-1");
          assert.equal(tenantId, "tenant-1");
          return booking;
        },
        async mergeRegistrationIntake() {
          return null;
        },
      },
      {
        async getById(tourId: string, tenantId: string) {
          assert.equal(tourId, "tour-1");
          assert.equal(tenantId, "tenant-1");
          return tour;
        },
      },
      () => ({
        currency: "IRR",
        obligationMinor: "1300000",
        source: "tour_canonical",
        lines: [
          { code: "trip", amountMinor: "1000000" },
          { code: "transport", amountMinor: "300000" },
        ],
      }),
      () => "IRR"
    );

    const obligation = await adapter.resolveRegistrationObligation({
      tenantId: "tenant-1",
      registrationId: "reg-1",
    });

    assert.ok(obligation !== null);
    assert.equal(obligation.obligationMinor, "1300000");
    assert.equal(obligation.discountableBaseMinor, "1000000");
  });

  it("CP-FC2-03 FinanceService wires obligation checks (create warn + approve block)", () => {
    const src = readFileSync(
      resolve(REPO_ROOT, "packages/finance-core/src/application/finance.service.ts"),
      "utf8"
    );
    assert.match(src, /finance\.obligation\.manual_amount_override/);
    assert.match(src, /FINANCE_OBLIGATION_OVERPAY/);
    assert.match(src, /obligation\.resolveRegistrationObligation/);
    assert.match(src, /obligation\.setRegistrationObligationOverride/);
    assert.doesNotMatch(src, /bookingPayments\.setObligationOverride/);
  });
});
