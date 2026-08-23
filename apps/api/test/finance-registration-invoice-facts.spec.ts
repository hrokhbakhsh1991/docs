/**
 * Finance registration invoice facts — bounded reads (AP15 P1).
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import { loadRegistrationInvoiceFacts } from "../src/finance/load-registration-invoice-facts";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FINANCE_REPO = path.join(
  REPO_ROOT,
  "src/workspace-finance/infrastructure/prisma-finance.repository.ts"
);
const INVOICE_FACTS = path.join(REPO_ROOT, "src/finance/load-registration-invoice-facts.ts");

describe("finance-registration-invoice-facts.spec.ts", () => {
  it("FIN-INV-01 getRegistrationInvoiceFacts delegates to loadRegistrationInvoiceFacts", () => {
    const source = fs.readFileSync(FINANCE_REPO, "utf8");
    assert.match(source, /loadRegistrationInvoiceFacts\s*\(/, FINANCE_REPO);
    assert.match(source, /async getRegistrationInvoiceFacts\(/, FINANCE_REPO);
  });

  it("FIN-INV-02 findPaymentStatusesByRegistration uses take cap", () => {
    const source = fs.readFileSync(FINANCE_REPO, "utf8");
    const body = source.match(/async findPaymentStatusesByRegistration\([\s\S]*?\n  \}/)?.[0];
    assert.ok(body !== undefined, FINANCE_REPO);
    assert.match(body, /take:\s*MAX_PAYMENTS_PER_REGISTRATION/, FINANCE_REPO);
  });

  it("FIN-INV-03 loadRegistrationInvoiceFacts uses SQL aggregate and bounded payment list", () => {
    const source = fs.readFileSync(INVOICE_FACTS, "utf8");
    assert.match(source, /\$queryRaw/);
    assert.match(source, /finance\.prepayment\.recorded/);
    assert.match(source, /take:\s*MAX_PAYMENTS_PER_REGISTRATION/);
  });

  it("FIN-INV-04 does not invent a product currency when facts carry none", async () => {
    const queryRows = [[{ sum: "0" }], [{ sum: "0" }], [{ sum: "0" }]];
    const tx = {
      $queryRaw: async () => queryRows.shift(),
      payment: {
        findMany: async () => [],
      },
      outboxEvent: {
        findFirst: async () => null,
      },
    };

    const facts = await loadRegistrationInvoiceFacts(tx as never, "tenant-id", "registration-id");

    assert.equal(facts.currency, "");
  });

  it("FIN-INV-05 keeps currency resolved from stored prepayment or payment facts", async () => {
    const queryRows = [[{ sum: "2500" }], [{ sum: "1000" }], [{ sum: "0" }]];
    const tx = {
      $queryRaw: async () => queryRows.shift(),
      payment: {
        findMany: async () => [{ amount: "1000", currency: "CAD", status: "Paid" }],
      },
      outboxEvent: {
        findFirst: async () => ({ payload: { currency: "USD" } }),
      },
    };

    const facts = await loadRegistrationInvoiceFacts(tx as never, "tenant-id", "registration-id");

    assert.equal(facts.currency, "CAD");
  });

  it("FIN-INV-06 source keeps invoice fact loaders workspace-neutral for currency fallback", () => {
    const source = fs.readFileSync(INVOICE_FACTS, "utf8");
    const memorySource = fs.readFileSync(
      path.join(REPO_ROOT, "src/workspace-finance/in-memory-finance.repository.ts"),
      "utf8"
    );

    assert.doesNotMatch(source, /let\s+currency\s*=\s*"IRR"/);
    assert.doesNotMatch(memorySource, /let\s+currency\s*=\s*"IRR"/);
  });
});
