/**
 * Finance registration invoice facts — bounded reads (AP15 P1).
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FINANCE_REPO = path.join(REPO_ROOT, "src/workspace-finance/finance.repository.ts");
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
});
