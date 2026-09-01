import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const portalRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

function readPortal(relativePath: string): string {
  return readFileSync(join(portalRoot, relativePath), "utf8");
}

describe("portal user-facing count localization", () => {
  it("PTL-COUNT-01 registration detail localizes transport occupants for display only", () => {
    const page = readPortal("app/me/registrations/[id]/page.tsx");
    assert.match(page, /formatLocalizedNumber\(personalCarOccupants, locale\)/);
    assert.doesNotMatch(page, /personalCarOccupants:\s*personalCarOccupants/);
  });

  it("PTL-COUNT-02 registration list filter badges localize counts", () => {
    const page = readPortal("app/me/registrations/page.tsx");
    assert.match(page, /formatLocalizedNumber\(count, locale\)/);
  });

  it("PTL-COUNT-03 intake amend keeps numeric select values while localizing labels", () => {
    const form = readPortal("app/me/registrations/[id]/member-intake-amend-form.tsx");
    assert.match(form, /<option key=\{value\} value=\{value\}>/);
    assert.match(form, /formatLocalizedNumber\(value, locale\)/);
    assert.match(form, /personalCarOccupants: occupants/);
    assert.doesNotMatch(form, /setOccupants\(formatLocalizedNumber/);
  });

  it("PTL-COUNT-04 catalog intake personalCarOccupants labels are pre-localized in fa messages", () => {
    const messages = readFileSync(
      join(portalRoot, "messages/fa/catalogRegistration.json"),
      "utf8"
    );
    assert.match(messages, /"1": "۱ نفر"/);
    assert.match(messages, /"2": "۲ نفر"/);
    assert.match(messages, /"3": "۳ نفر"/);
  });
});
