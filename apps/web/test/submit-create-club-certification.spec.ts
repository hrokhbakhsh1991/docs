import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { resolveCreateClubErrorMessage } from "../src/platform/create-club/submit-create-club";

describe("submit create club (Phase H4)", () => {
  it("maps WORKSPACE_NOT_CERTIFIED_FOR_PRODUCTION to user-facing message", () => {
    const message = resolveCreateClubErrorMessage({
      error: "workspace_not_certified_for_production",
      code: "WORKSPACE_NOT_CERTIFIED_FOR_PRODUCTION",
    });
    assert.match(message, /not certified/i);
  });

  it("tenants-create route handles certification error", () => {
    const source = readFileSync(
      new URL("../../api/src/routes/platform/tenants-create.ts", import.meta.url),
      "utf8"
    );
    assert.match(source, /WorkspaceNotCertifiedForProductionError/);
    assert.match(source, /workspace_not_certified_for_production/);
  });
});
