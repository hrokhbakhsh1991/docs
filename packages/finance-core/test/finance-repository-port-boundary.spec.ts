/**
 * Phase 2.1 — finance-core knows FinanceRepositoryPort only (never Prisma impl).
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const PKG = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(PKG, "src");
const PORT = join(SRC, "ports/finance-repository.port.ts");
const SERVICE = join(SRC, "application/finance.service.ts");
const BOOKING_PORT = join(SRC, "ports/booking-payment.port.ts");

function walkTs(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, name.name);
    if (name.isDirectory()) out.push(...walkTs(p));
    else if (name.name.endsWith(".ts")) out.push(p);
  }
  return out;
}

describe("FIN-P2.1 finance-core → FinanceRepositoryPort", () => {
  it("FinanceRepositoryPort is an interface with plain DTOs (no Prisma / TX client)", () => {
    const src = readFileSync(PORT, "utf8");
    assert.match(src, /export interface FinanceRepositoryPort/);
    assert.doesNotMatch(src, /export type FinanceRepositoryPort\s*=/);
    assert.doesNotMatch(src, /FinanceRepository\s*\||InMemoryFinanceRepository|PrismaFinanceRepository/);
    assert.doesNotMatch(src, /@prisma\/client|Prisma\.|TransactionClient|withTenantRls/);
  });

  it("FinanceTransactionPort is opaque (no Prisma.TransactionClient)", () => {
    const src = readFileSync(BOOKING_PORT, "utf8");
    assert.match(src, /export type FinanceTransactionPort\s*=\s*object/);
    assert.doesNotMatch(src, /TransactionClient|@prisma\/client/);
  });

  it("FinanceService depends on FinanceRepositoryPort only — not infrastructure", () => {
    const src = readFileSync(SERVICE, "utf8");
    assert.match(src, /FinanceRepositoryPort/);
    assert.match(src, /from ["']\.\.\/ports\/finance-repository\.port["']/);
    assert.doesNotMatch(src, /PrismaFinanceRepository|InMemoryFinanceRepository|finance\.repository/);
    assert.doesNotMatch(src, /@prisma\/client|withTenantRls|TransactionClient/);
  });

  it("entire finance-core src tree has zero Prisma / TX client / concrete repo unions", () => {
    for (const file of walkTs(SRC)) {
      const src = readFileSync(file, "utf8");
      const rel = file.slice(SRC.length + 1);
      assert.doesNotMatch(src, /@prisma\/client/, rel);
      assert.doesNotMatch(src, /Prisma\.TransactionClient/, rel);
      assert.doesNotMatch(src, /withTenantRls/, rel);
      assert.doesNotMatch(src, /PrismaFinanceRepository/, rel);
      assert.doesNotMatch(
        src,
        /export type FinanceRepositoryPort\s*=\s*.*\|/,
        rel
      );
    }
  });
});
