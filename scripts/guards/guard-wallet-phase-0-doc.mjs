#!/usr/bin/env node
/**
 * Phase 0 — Wallet architecture documentation contract (no runtime Wallet code).
 *
 * @see docs/architecture/wallet-module-phase-0-contract.mdoc
 * @see docs/architecture/adr/ADR-WALLET-001-member-wallet-bounded-context.mdoc
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../..");

/** @type {{ id: string, ok: boolean, detail: string }[]} */
const results = [];

/**
 * @param {string} id
 * @param {boolean} ok
 * @param {string} detail
 */
function record(id, ok, detail) {
  results.push({ id, ok, detail });
  const tag = ok ? "PASS" : "FAIL";
  console.log(`[${tag}] ${id}: ${detail}`);
}

/**
 * @param {string} rel
 */
function read(rel) {
  return fs.readFileSync(path.join(REPO_ROOT, rel), "utf8");
}

/**
 * @param {string} rel
 * @param {readonly string[]} needles
 */
function assertContainsAll(rel, needles) {
  const text = read(rel);
  for (const needle of needles) {
    if (!text.includes(needle)) {
      record(`doc-${path.basename(rel)}`, false, `missing required text: ${needle}`);
      return false;
    }
  }
  record(`doc-${path.basename(rel)}`, true, `required sections present (${needles.length} checks)`);
  return true;
}

function main() {
  const adr = "docs/architecture/adr/ADR-WALLET-001-member-wallet-bounded-context.mdoc";
  const contract = "docs/architecture/wallet-module-phase-0-contract.mdoc";

  for (const rel of [adr, contract]) {
    if (!fs.existsSync(path.join(REPO_ROOT, rel))) {
      record(`exists-${path.basename(rel)}`, false, `missing file: ${rel}`);
      continue;
    }
    record(`exists-${path.basename(rel)}`, true, rel);
  }

  assertContainsAll(adr, [
    "Member Wallet",
    "registration Finance",
    "bookingWalletId",
    "finance.ledger",
    "wallet-core",
    "workspaceWallet",
    "tenant_id",
    "Phase 0",
  ]);

  assertContainsAll(contract, [
    "bookingWalletId",
    "walletNetMinor",
    "workspaceWallet",
    "FORBIDDEN_WALLET_MODULE_DISABLED",
    "member.module.wallet",
    "withTenantRls",
    "Immutable ledger",
    "Balance authority",
    "wallet.mjs",
    "Phase 0",
    "phase_1_contract_foundation",
    "No Wallet domain",
  ]);

  const readme = read("docs/architecture/README.md");
  const readmeOk =
    readme.includes("ADR-WALLET-001") && readme.includes("wallet-module-phase-0-contract.mdoc");
  record("architecture-readme-index", readmeOk, readmeOk ? "links present" : "missing wallet doc links");

  const failed = results.filter((r) => !r.ok);
  if (failed.length > 0) {
    console.error(`guard-wallet-phase-0-doc: FAIL (${failed.length} checks)`);
    process.exit(1);
  }
  console.log(`guard-wallet-phase-0-doc: PASS (${results.length} checks)`);
}

main();
