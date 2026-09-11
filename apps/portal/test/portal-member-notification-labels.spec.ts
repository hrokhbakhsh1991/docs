import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const panelPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "../src/me/notifications/member-ticket-notifications-panel.tsx"
);

describe("portal member notification labels", () => {
  it("does not render a notification payload key as a Persian title", () => {
    const panel = readFileSync(panelPath, "utf8");
    assert.match(panel, /isRawTranslationKey\(localizedTitle\)/);
    assert.match(panel, /portalMember\|tickets\|settings\|nav\|common/);
    assert.match(panel, /payload\?\.ticketId/);
    assert.match(panel, /eventTitles\.registrationApproved/);
  });

  it("keeps notifications without a destination read-only", () => {
    const panel = readFileSync(panelPath, "utf8");
    assert.match(panel, /const readOnly = href === "\/me\/notifications"/);
    assert.match(panel, /if \(readOnly\) \{[\s\S]*event\.preventDefault\(\)/);
  });
});
