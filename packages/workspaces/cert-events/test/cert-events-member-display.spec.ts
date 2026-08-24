import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const REPO_ROOT = join(import.meta.dirname, "..", "..", "..", "..");

describe("cert-events member display (CW9-06)", () => {
  it("CW9-06-01 manifest declares native vocabulary display map", () => {
    const manifest = JSON.parse(
      readFileSync(
        join(REPO_ROOT, "packages/workspaces/cert-events/workspace.manifest.json"),
        "utf8"
      )
    );
    const display = manifest.memberPortal?.registrationStatusDisplay;
    assert.deepEqual(display, {
      confirmed: "accepted",
      waitlist: "waitlisted",
      cancelled: "cancelled",
    });
    assert.equal(manifest.workspaceBooking?.supported, false);
  });

  it("CW9-06-02 codegen projects cert-events registration status display", async () => {
    const generated = readFileSync(
      join(
        REPO_ROOT,
        "packages/workspace-sdk/src/portal/workspace-member-registration-status-display.generated.ts"
      ),
      "utf8"
    );
    assert.match(generated, /cert-events/);
    assert.match(generated, /confirmed/);
    assert.match(generated, /accepted/);
  });
});
