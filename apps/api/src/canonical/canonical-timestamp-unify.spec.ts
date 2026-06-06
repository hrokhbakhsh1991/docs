import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function readSource(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

describe("canonical timestamp unify (DEC-077 / CLK-F-01/02)", () => {
  it("atomic persist binds tour, audit, and outbox to txNow", () => {
    const source = readSource("canonical/atomic-canonical-tour-persist.ts");
    assert.match(source, /const txNow = await readCanonicalTransactionNow\(tx\)/);
    assert.match(source, /createdAt:\s*txNow/);
    assert.doesNotMatch(source, /const createdAt = new Date\(\)/);
  });

  it("enqueue and audit accept explicit createdAt for DB authority", () => {
    const audit = readSource("audit/audit-logger.ts");
    const enqueue = readSource("outbox/enqueue-domain-event.ts");
    assert.match(audit, /createdAt:\s*input\.createdAt/);
    assert.match(enqueue, /createdAt:\s*input\.createdAt/);
  });

  it("outbox relay maps occurredAt from persisted row created_at", () => {
    const relay = readSource("outbox/outbox-relay.ts");
    assert.match(relay, /occurredAt:\s*row\.createdAt\.toISOString\(\)/);
  });
});
