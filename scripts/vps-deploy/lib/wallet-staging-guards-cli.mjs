#!/usr/bin/env node
/**
 * CLI for bash deploy scripts — validates staging guards without logging secrets.
 */
import { validateWalletStagingDeploy, validateWalletStagingRollback } from "./wallet-staging-guards.mjs";

const command = process.argv[2] ?? "validate-deploy";

function printResult(label, result) {
  if (result.ok) {
    process.stdout.write(`${label}: PASS\n`);
    return 0;
  }
  process.stderr.write(`${label}: FAIL\n`);
  for (const error of result.errors) {
    process.stderr.write(`  - ${error}\n`);
  }
  return 1;
}

if (command === "validate-deploy") {
  process.exit(printResult("wallet-staging-guards", validateWalletStagingDeploy(process.env)));
}

if (command === "validate-rollback") {
  process.exit(printResult("wallet-staging-rollback-guards", validateWalletStagingRollback(process.env)));
}

process.stderr.write(`wallet-staging-guards-cli: unknown command ${command}\n`);
process.exit(2);
