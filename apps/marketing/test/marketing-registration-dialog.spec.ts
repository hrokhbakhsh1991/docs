import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

describe("marketing-registration-dialog", () => {
  it("MKT-PCMS-05 bootstraps delegated modal handling before React hydration", () => {
    const dialog = readFileSync(
      join(repoRoot, "apps/marketing/src/catalog/marketing-registration-dialog.tsx"),
      "utf8"
    );
    assert.match(dialog, /window\.__marketingRegistrationDialogBootstrapped/);
    assert.match(dialog, /target\.closest\("\[data-marketing-dialog-src\]"\)/);
    assert.match(dialog, /dialog\.showModal\(\)/);
    assert.match(dialog, /data-marketing-registration-dialog-open/);
    assert.match(dialog, /data-marketing-registration-dialog-frame/);
  });

  it("MKT-PCMS-06 exposes dialog readiness for deterministic runtime checks", () => {
    const dialog = readFileSync(
      join(repoRoot, "apps/marketing/src/catalog/marketing-registration-dialog.tsx"),
      "utf8"
    );
    assert.match(dialog, /data-marketing-registration-dialog-ready="false"/);
    assert.match(dialog, /dialog\.setAttribute\("data-marketing-registration-dialog-ready", "true"\)/);
  });
});
