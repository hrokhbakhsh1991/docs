import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  resolveWorkspaceThemeTokens,
  validateWorkspaceThemeTokenMap,
  WorkspaceThemeTokenValidationError,
} from "@app-tour/platform-core";

describe("resolveWorkspaceThemeTokens (P3-B-N-014)", () => {
  it("TH-01 accepts --ws-primary semantic key", () => {
    const tokens = validateWorkspaceThemeTokenMap({
      "--ws-primary": "var(--color-primary)",
    });
    assert.equal(tokens["--ws-primary"], "var(--color-primary)");
    assert.deepEqual(
      resolveWorkspaceThemeTokens({ tokens: { "--ws-primary": "#112233" } }),
      { "--ws-primary": "#112233" }
    );
  });

  it("TH-02 rejects #ff0000 as top-level token key", () => {
    assert.throws(
      () => validateWorkspaceThemeTokenMap({ "#ff0000": "red" }),
      (error: unknown) => {
        assert.ok(error instanceof WorkspaceThemeTokenValidationError);
        assert.match(String(error.message), /WORKSPACE_THEME_TOKEN_KEY_INVALID:#ff0000/);
        return true;
      }
    );
  });
});
