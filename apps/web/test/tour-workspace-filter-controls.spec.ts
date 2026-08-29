/**
 * Tour Workspace filter chrome — compact controls aligned with Users/Bookings directory pattern.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("tour-workspace-filter-controls.spec.ts", () => {
  it("TW-FLT-01 shared operator directory filter chrome exists", () => {
    const chrome = readFileSync(
      join(webRoot, "src/admin/patterns/operator-directory-filter-chrome.tsx"),
      "utf8"
    );
    assert.match(chrome, /OperatorDirectoryFilterChrome/);
    assert.match(chrome, /Popover/);
    assert.match(chrome, /activeChips/);
  });

  it("TW-FLT-02 finance tab uses compact controls not button wall", () => {
    const client = readFileSync(
      join(webRoot, "src/features/tours/tour-workspace-finance-client.tsx"),
      "utf8"
    );
    const controls = readFileSync(
      join(webRoot, "src/features/tours/tour-workspace-finance-controls.tsx"),
      "utf8"
    );
    assert.match(client, /TourWorkspaceFinanceControls/);
    assert.doesNotMatch(client, /FILTERS\.map/);
    assert.match(controls, /OperatorDirectoryFilterChrome/);
    assert.match(controls, /TOUR_WORKSPACE_FINANCE_TEST_IDS\.activeFilters/);
  });

  it("TW-FLT-03 transport tab uses filter popover + active chips", () => {
    const client = readFileSync(
      join(webRoot, "app/(app)/tours/[id]/workspace/transport/tour-workspace-transport-client.tsx"),
      "utf8"
    );
    const controls = readFileSync(
      join(webRoot, "src/features/tours/tour-workspace-transport-controls.tsx"),
      "utf8"
    );
    assert.match(client, /TourWorkspaceTransportControls/);
    assert.doesNotMatch(client, /OPERATIONAL_ROSTER_FILTERS\.map/);
    assert.match(controls, /activeFilters\.roster/);
  });

  it("TW-FLT-04 workspace bookings embed uses compact controls", () => {
    const shell = readFileSync(
      join(webRoot, "src/features/bookings/bookings-command-center-shell.tsx"),
      "utf8"
    );
    const controls = readFileSync(
      join(webRoot, "src/features/bookings/bookings-workspace-embedded-controls.tsx"),
      "utf8"
    );
    assert.match(shell, /embedded \? \(/);
    assert.match(shell, /BookingsWorkspaceEmbeddedControls/);
    assert.match(controls, /BOOKINGS_COMMAND_CENTER_TEST_IDS\.activeFilters/);
    assert.match(controls, /<select/);
    assert.doesNotMatch(controls, /variant=\{query\.status === status \? "default" : "outline"\}/);
  });

  it("TW-FLT-05 i18n exposes workspace filter chip labels", () => {
    const fa = JSON.parse(
      readFileSync(join(webRoot, "messages/fa/tours.json"), "utf8")
    ) as {
      workspace: { controls: { filtersToggle: string; activeFilters: { payment: string } } };
    };
    const en = JSON.parse(
      readFileSync(join(webRoot, "messages/en/tours.json"), "utf8")
    ) as {
      workspace: { controls: { filtersToggle: string; activeFilters: { roster: string } } };
    };
    assert.match(fa.workspace.controls.filtersToggle, /فیلتر/);
    assert.match(fa.workspace.controls.activeFilters.payment, /پرداخت/);
    assert.match(en.workspace.controls.activeFilters.roster, /Transport/);
  });
});
