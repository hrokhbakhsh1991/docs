/**
 * Phase 1.7 Commit 1 — finance host must not instantiate Denali outbox consumer.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../");

describe("finance-outbox-ownership.spec.ts — Phase 1.7 C1", () => {
  it("FIN-P1.7-C1-01 process-workspace-finance-outbox does not create Denali consumer", () => {
    const src = readFileSync(
      resolve(REPO_ROOT, "apps/api/src/workspace-finance/process-workspace-finance-outbox.ts"),
      "utf8"
    );
    assert.doesNotMatch(src, /createDenaliFinanceOutboxConsumer/);
    assert.match(src, /consumeDenaliTourCreatedFinanceOutbox/);
  });

  it("FIN-P1.7-C1-02 Denali owns createDenaliFinanceOutboxConsumer composition entry", () => {
    const denali = readFileSync(
      resolve(
        REPO_ROOT,
        "packages/workspaces/denali/src/finance/finance-outbox-consumer.ts"
      ),
      "utf8"
    );
    assert.match(denali, /export function createDenaliFinanceOutboxConsumer/);
    assert.match(denali, /export async function consumeDenaliTourCreatedFinanceOutbox/);
    assert.match(
      denali,
      /consumeDenaliTourCreatedFinanceOutbox[\s\S]*createDenaliFinanceOutboxConsumer\(deps\)\.consumePending/
    );
  });
});
