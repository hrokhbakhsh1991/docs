/**
 * Phase 2.1 — apps/api owns PrismaFinanceRepository implements FinanceRepositoryPort.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const PRISMA_REPO =
  "apps/api/src/workspace-finance/infrastructure/prisma-finance.repository.ts";
const FACTORY = "apps/api/src/workspace-finance/finance-repository.factory.ts";
const FACADE = "apps/api/src/workspace-finance/finance.repository.ts";
const PORT_FACADE = "apps/api/src/workspace-finance/ports/finance-repository.port.ts";
const BOOKING_ADAPTER =
  "apps/api/src/workspace-finance/infrastructure/booking-payment.adapter.ts";
const OUTBOX_WRITER =
  "apps/api/src/workspace-finance/infrastructure/prisma-workspace-outbox-writer.ts";
const CORE_PORT = "packages/finance-core/src/ports/finance-repository.port.ts";
const CORE_SERVICE = "packages/finance-core/src/application/finance.service.ts";

function read(rel: string): string {
  return readFileSync(resolve(REPO_ROOT, rel), "utf8");
}

describe("FIN-P2.1 apps/api → PrismaFinanceRepository", () => {
  it("PrismaFinanceRepository implements FinanceRepositoryPort from finance-core", () => {
    const src = read(PRISMA_REPO);
    assert.match(src, /export class PrismaFinanceRepository implements FinanceRepositoryPort/);
    assert.match(src, /from ["']@app-tour\/finance-core["']/);
    assert.match(src, /from ["']@prisma\/client["']/);
    assert.match(src, /withTenantRls/);
  });

  it("Prisma adapter maps rows through toFinance*Row (no raw Prisma DTO return)", () => {
    const src = read(PRISMA_REPO);
    assert.match(src, /function toFinancePaymentRow/);
    assert.match(src, /function toFinanceReceiptRow/);
    assert.match(src, /function toFinanceOpenPaymentRow/);
    assert.match(src, /function toFinanceLedgerOutboxRow/);
    assert.doesNotMatch(src, /return rows;\n/);
    assert.doesNotMatch(src, /return existingByKey;/);
    assert.doesNotMatch(src, /return byHash;/);
  });

  it("approve atomic keeps RLS + booking raise + outbox last (order unchanged)", () => {
    const src = read(PRISMA_REPO);
    const approve = src.slice(src.indexOf("async approveManualReceiptAtomic"));
    const paid = approve.indexOf('status: "Paid"');
    const raise = approve.indexOf("raisePaidInTx");
    const approved = approve.indexOf('status: "Approved"');
    const outbox = approve.indexOf("enqueueFinanceLedgerCaptureOutbox");
    assert.ok(paid >= 0 && raise > paid && approved > raise && outbox > approved);
    assert.match(approve, /withTenantRls/);
    assert.match(approve, /tx as FinanceTransactionPort/);
  });

  it("factory returns FinanceRepositoryPort — not a concrete union type alias", () => {
    const src = read(FACTORY);
    assert.match(src, /\):\s*FinanceRepositoryPort\s*\{/);
    assert.match(src, /new PrismaFinanceRepository/);
    assert.match(src, /new InMemoryFinanceRepository/);
    assert.doesNotMatch(src, /export type FinanceRepositoryPort\s*=/);
    assert.doesNotMatch(src, /FinanceRepository\s*\|\s*InMemory/);
  });

  it("façade / ports re-export types only — never PrismaFinanceRepository", () => {
    const facade = read(FACADE);
    const port = read(PORT_FACADE);
    assert.match(facade, /export type \{/);
    assert.match(port, /from ["']@app-tour\/finance-core["']/);
    assert.doesNotMatch(facade, /PrismaFinanceRepository|@prisma\/client|withTenantRls/);
    assert.doesNotMatch(port, /PrismaFinanceRepository|@prisma\/client|TransactionClient/);
  });

  it("TransactionClient cast stays in infrastructure adapters only", () => {
    const booking = read(BOOKING_ADAPTER);
    const outbox = read(OUTBOX_WRITER);
    assert.match(booking, /tx as Prisma\.TransactionClient/);
    assert.match(outbox, /tx as Prisma\.TransactionClient/);
    assert.doesNotMatch(read(CORE_PORT), /TransactionClient/);
    assert.doesNotMatch(read(CORE_SERVICE), /TransactionClient/);
    assert.doesNotMatch(read(PORT_FACADE), /TransactionClient/);
  });

  it("ownership split: core → port; api → implementation", () => {
    assert.match(read(CORE_SERVICE), /FinanceRepositoryPort/);
    assert.doesNotMatch(read(CORE_SERVICE), /PrismaFinanceRepository/);
    assert.match(read(PRISMA_REPO), /implements FinanceRepositoryPort/);
    assert.match(read(CORE_PORT), /export interface FinanceRepositoryPort/);
  });
});
