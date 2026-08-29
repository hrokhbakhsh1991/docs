/**
 * Operator UI consistency batch — shared pattern wiring (local batch).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { OPERATOR_SEARCHABLE_SELECT_TEST_IDS } from "../src/admin/patterns/operator-searchable-select";
import { FINANCE_TOUR_FILTER_TEST_IDS } from "../src/finance/finance-tour-filter";
import { BOOKINGS_COMMAND_CENTER_TEST_IDS } from "../src/features/bookings/bookings-command-center-types";

const WEB_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function read(rel: string): string {
  return readFileSync(resolve(WEB_ROOT, rel), "utf8");
}

describe("operator-ui-consistency.spec.ts", () => {
  it("WEB-OPUI-01 finance tour filter uses scalable tour autocomplete", () => {
    const filter = read("src/finance/finance-tour-filter.tsx");
    assert.match(filter, /OperatorTourSelect/);
    assert.match(filter, new RegExp(FINANCE_TOUR_FILTER_TEST_IDS.root));
    assert.match(filter, /data-operator-finance-tour-filter/);
    assert.doesNotMatch(filter, /tourChips\.map\(\(chip\) => \(\s*<Button/);
  });

  it("WEB-OPUI-02 sidebar collapse lives in header row with reserved grid slot", () => {
    const nav = read("src/admin/shell/operator-nav.tsx");
    assert.match(nav, /data-operator-sidebar-header-row/);
    assert.match(nav, /data-operator-sidebar-collapse-wrap/);
    const headerIndex = nav.indexOf("data-operator-sidebar-header-row");
    const footerIndex = nav.indexOf("data-operator-sidebar-footer");
    const collapseIndex = nav.indexOf("data-operator-sidebar-collapse");
    assert.ok(headerIndex >= 0 && collapseIndex > headerIndex);
    assert.ok(footerIndex < 0 || collapseIndex < footerIndex);

    const css = readFileSync(
      resolve(WEB_ROOT, "../../packages/design-tokens/src/operator-shell-structure.css"),
      "utf8"
    );
    assert.match(css, /\[data-operator-sidebar-header-row\][\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s*auto/);
    assert.match(
      css,
      /\[data-operator-sidebar\]\[data-operator-sidebar-collapsed="true"\]\s*\[data-operator-sidebar-header-row\][\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)/
    );
  });

  it("WEB-OPUI-02b sidebar collapse visible from tablet breakpoint", () => {
    const css = readFileSync(
      resolve(WEB_ROOT, "../../packages/design-tokens/src/operator-shell-structure.css"),
      "utf8"
    );
    assert.match(css, /@media \(min-width: 768px\)[\s\S]*data-operator-sidebar-collapse-wrap/);
    assert.doesNotMatch(css, /@media \(min-width: 1200px\)[\s\S]*data-operator-sidebar-collapse-wrap/);
  });

  it("WEB-OPUI-02c sidebar navigation does not prefetch heavy operator routes", () => {
    const nav = read("src/admin/shell/operator-nav.tsx");
    const prefetchDisabledCount = (nav.match(/prefetch=\{false\}/g) ?? []).length;
    assert.ok(prefetchDisabledCount >= 2);
  });

  it("WEB-OPUI-03 bookings inbox row shows member avatar + status badges", () => {
    const row = read("src/features/bookings/booking-inbox-row.tsx");
    const avatar = read("src/features/bookings/booking-member-avatar.tsx");
    assert.match(row, /BookingMemberAvatar/);
    assert.match(row, /OperatorStatusBadge/);
    assert.match(avatar, /BOOKINGS_COMMAND_CENTER_TEST_IDS\.rowAvatar/);
  });

  it("WEB-OPUI-04 users detail sheet uses detailSheet motion profile", () => {
    const sheet = read("app/(app)/users/users-member-detail-sheet.tsx");
    assert.match(sheet, /detailSheet/);
    assert.match(sheet, /sm:max-w-2xl/);
    assert.match(sheet, /heldUser/);

    const motionCss = readFileSync(
      resolve(WEB_ROOT, "../../packages/design-tokens/src/operator-sheet-motion.css"),
      "utf8"
    );
    assert.match(motionCss, /\[data-operator-sheet-panel\]\[data-operator-detail-sheet="true"\]/);
    assert.match(motionCss, /prefers-reduced-motion:\s*reduce/);

    const uiSheet = read("src/components/ui/sheet.tsx");
    assert.match(uiSheet, /data-operator-sheet-panel/);
    assert.match(uiSheet, /data-operator-sheet-overlay/);
  });

  it("WEB-OPUI-05 header account menu uses icon avatar fallback", () => {
    const menu = read("src/admin/shell/operator-account-menu.tsx");
    assert.match(menu, /fallbackMode="icon"/);
  });

  it("WEB-OPUI-06 tour status badge uses semantic success for active", () => {
    const badge = read("app/(app)/tours/tour-status-badge.tsx");
    assert.match(badge, /active:\s*"success"/);
    assert.match(badge, /OperatorStatusBadge/);
  });

  it("WEB-OPUI-07 searchable select exposes keyboard listbox contract", () => {
    const select = read("src/admin/patterns/operator-searchable-select.tsx");
    assert.match(select, new RegExp(OPERATOR_SEARCHABLE_SELECT_TEST_IDS.trigger));
    assert.match(select, /role="listbox"/);
    assert.match(select, /ArrowDown/);
  });

  it("WEB-OPUI-08 shared select affordance + motion wired in admin bootstrap", () => {
    const bootstrap = readFileSync(
      resolve(WEB_ROOT, "../../packages/design-tokens/src/admin-bootstrap.css"),
      "utf8"
    );
    assert.match(bootstrap, /operator-select-affordance\.css/);
    assert.match(bootstrap, /operator-select-motion\.css/);

    const affordanceCss = readFileSync(
      resolve(WEB_ROOT, "../../packages/design-tokens/src/operator-select-affordance.css"),
      "utf8"
    );
    assert.match(affordanceCss, /\[data-operator-searchable-select-trigger\]/);
    assert.match(affordanceCss, /background-position:\s*center inline-end/);

    const motionCss = readFileSync(
      resolve(WEB_ROOT, "../../packages/design-tokens/src/operator-select-motion.css"),
      "utf8"
    );
    assert.match(motionCss, /\[data-operator-searchable-select-panel\]\[data-state="open"\]/);
    assert.match(motionCss, /180ms/);
    assert.match(motionCss, /140ms/);
    assert.match(motionCss, /prefers-reduced-motion:\s*reduce/);

    const popover = read("src/components/ui/popover.tsx");
    assert.doesNotMatch(popover, /animate-in/);
    assert.match(popover, /motion-reduce:animate-none/);

    const denaliSelect = readFileSync(
      resolve(WEB_ROOT, "../../packages/workspaces/denali/src/ui/components/denali-searchable-select.tsx"),
      "utf8"
    );
    assert.match(denaliSelect, /data-operator-searchable-select-panel/);
    assert.match(denaliSelect, /data-state=\{panelState\}/);
  });
});
