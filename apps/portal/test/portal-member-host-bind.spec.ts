import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

describe("portal me layout — P8-1-N-002 G-SES-05", () => {
  it("compares session tenantId to portal bootstrap host tenant", () => {
    const source = readFileSync(join(repoRoot, "apps/portal/app/me/layout.tsx"), "utf8");
    assert.match(source, /resolvePortalBootstrapForHost/);
    assert.match(source, /session\.tenantId !== bootstrap\.tenantId/);
  });
});
