import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const panelPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "../src/me/notifications/member-ticket-notifications-panel.tsx"
);
const formatPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "../src/me/notifications/member-notifications-format.ts"
);

describe("portal member notification labels", () => {
  it("does not render a notification payload key as a Persian title", () => {
    const panel = readFileSync(panelPath, "utf8");
    const format = readFileSync(formatPath, "utf8");
    assert.match(panel, /isRawTranslationKey\(localizedTitle\)/);
    assert.match(format, /portalMember\|tickets\|settings\|nav\|common\|engagement/);
    assert.match(panel, /payload\?\.ticketId/);
    assert.match(panel, /eventTitles\.registrationApproved/);
    assert.match(panel, /eventTitles\.receiptApproved/);
    assert.match(panel, /eventBodies\.receiptApproved/);
  });

  it("keeps notifications without a destination read-only", () => {
    const panel = readFileSync(panelPath, "utf8");
    assert.match(panel, /const readOnly = href === "\/me\/notifications"/);
    assert.match(panel, /if \(readOnly\) \{[\s\S]*event\.preventDefault\(\)/);
  });
});
