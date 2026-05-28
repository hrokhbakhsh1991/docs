#!/usr/bin/env node
/**
 * CI: finance ledger paths must keep centralized tenant-scope assertions so enqueue / reconciliation
 * cannot mix tenants without throwing (defense against accidental cross-tenant joins).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");

const CHECKS = [
  {
    rel: "apps/api/src/modules/finance/ledger/emit-finance-ledger-journal-outbox.ts",
    needles: ["assertLedgerLinesFinanceTenantScope", "normalizeFinanceTenantId"]
  },
  {
    rel: "apps/api/src/modules/finance/reconciliation/payment-reconciliation-report.ts",
    needles: ["assertLedgerLinesFinanceTenantScope", "normalizeFinanceTenantId"]
  },
  {
    rel: "apps/api/src/modules/finance/ledger/wallet-projection.ts",
    needles: ["normalizeFinanceTenantId", "FINANCE_WALLET_TENANT_SCOPE"]
  },
  {
    rel: "apps/api/src/modules/finance/invoicing/immutable-invoice.ts",
    needles: ["assertLedgerLinesFinanceTenantScope"]
  }
];

function main() {
  for (const { rel, needles } of CHECKS) {
    const abs = path.join(REPO_ROOT, rel);
    const text = fs.readFileSync(abs, "utf8");
    for (const n of needles) {
      if (!text.includes(n)) {
        process.exit(1);
      }
    }
  }
}

main();
