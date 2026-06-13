import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const WEB_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

describe("reconciliation-triage-server-prefetch.spec.ts", () => {
  it("TRIAGE-01 reconciliation page prefetches on the server", () => {
    const pageSource = readFileSync(
      resolve(WEB_ROOT, "app/(app)/settings/reconciliation-triage/page.tsx"),
      "utf8"
    );
    assert.match(pageSource, /fetchReconciliationTriageServer/);
    assert.match(pageSource, /initialFindings/);
  });

  it("TRIAGE-02 reconciliation client skips first fetch when initialFindings is provided", () => {
    const clientSource = readFileSync(
      resolve(WEB_ROOT, "app/(app)/settings/reconciliation-triage/reconciliation-triage-client.tsx"),
      "utf8"
    );
    assert.match(clientSource, /initialFindings/);
    assert.match(clientSource, /skipInitialFetchRef/);
  });
});
