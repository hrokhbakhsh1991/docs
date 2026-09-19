import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  hrefForWorkspaceTab,
  listTourWorkspaceSubnavTabs,
  parseWorkspaceTabParam,
} from "../src/features/tours/tour-workspace-logic";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("tour workspace execution contract", () => {
  it("keeps execution as a first-class workspace tab", () => {
    assert.equal(parseWorkspaceTabParam("execution"), "execution");
    assert.match(hrefForWorkspaceTab("tour-id", "execution"), /tab=execution/);
    assert.equal(listTourWorkspaceSubnavTabs().some((item) => item.tab === "execution"), true);
  });

  it("proxies execution commands through authenticated BFF routes", () => {
    const readAndStart = readFileSync(join(webRoot, "app/api/tours/[id]/execution/route.ts"), "utf8");
    const complete = readFileSync(
      join(webRoot, "app/api/tours/[id]/execution/complete/route.ts"),
      "utf8"
    );
    const driver = readFileSync(
      join(webRoot, "app/api/tours/[id]/execution/drivers/[registrationId]/route.ts"),
      "utf8"
    );
    assert.match(readAndStart, /readSessionTokenFromRequest/);
    assert.match(readAndStart, /proxy\(req, id, "\/start", "POST"\)/);
    assert.match(complete, /execution\/complete/);
    assert.match(driver, /method: "PATCH"/);
    assert.match(driver, /execution\/drivers/);
  });

  it("keeps passenger-count recording separate from finance controls", () => {
    const panel = readFileSync(
      join(webRoot, "app/(app)/tours/[id]/workspace/execution/tour-workspace-execution-client.tsx"),
      "utf8"
    );
    assert.match(panel, /noFinancialSideEffect/);
    assert.match(panel, /actualPassengerCount/);
    assert.match(panel, /STALE_EXECUTION_VERSION/);
    assert.doesNotMatch(panel, /credit-wallet|withdrawal|wallet balance/i);
  });
});
