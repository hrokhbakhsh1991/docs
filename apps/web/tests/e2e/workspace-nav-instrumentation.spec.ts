/**
 * Workspace navigation instrumentation — distinguishes soft tab switches from
 * document-level navigations (full page feel under force-dynamic).
 *
 * Run (existing dev servers):
 *   PW_EXTERNAL_SERVERS=1 PLAYWRIGHT_BASE_URL=http://admin.denali.localhost:3000 \
 *     pnpm --filter @apps/web exec playwright test -c playwright.workspace-nav.config.ts
 */
import { expect, test, type Frame, type Page, type Request } from "@playwright/test";

import { TOUR_WORKSPACE_TEST_IDS } from "../../src/features/tours/tour-workspace-types";
import {
  loginOperatorWithPhone,
  OPERATOR_OWNER_MOBILE,
} from "../../test/fixtures/operator-owner-session";

const DEFAULT_TOUR_ID = "00000000-0000-4000-8000-000000000214";

type NavSample = {
  readonly label: string;
  readonly urlAfter: string;
  readonly documentRequests: readonly string[];
  readonly navigationRequests: readonly string[];
  readonly rscRequests: readonly string[];
};

function classifyRequest(
  req: Request,
  mainFrame: Frame
): "document" | "navigation" | "rsc" | null {
  if (req.frame() !== mainFrame) {
    return null;
  }
  const url = req.url();
  if (req.resourceType() === "document") {
    return "document";
  }
  if (req.isNavigationRequest()) {
    return "navigation";
  }
  if (url.includes("_rsc=") || req.headers()["rsc"] === "1" || req.headers()["next-router-state-tree"]) {
    return "rsc";
  }
  return null;
}

async function waitForTabSwitch(
  page: Page,
  tab: "waitlist" | "transport" | "finance" | "registrations"
): Promise<void> {
  if (tab === "registrations") {
    await expect(page).toHaveURL((url) => !url.searchParams.has("tab"), { timeout: 15_000 });
    await expect(page.getByTestId(TOUR_WORKSPACE_TEST_IDS.registrationsPanel)).toBeVisible({
      timeout: 90_000,
    });
    return;
  }
  await expect(page).toHaveURL(new RegExp(`tab=${tab}`), { timeout: 15_000 });
  const panelTestId =
    tab === "waitlist"
      ? TOUR_WORKSPACE_TEST_IDS.waitlistPanel
      : tab === "transport"
        ? TOUR_WORKSPACE_TEST_IDS.transportPanel
        : TOUR_WORKSPACE_TEST_IDS.financePanel;
  await expect(page.getByTestId(panelTestId)).toBeVisible({ timeout: 90_000 });
}

async function sampleInteraction(
  page: Page,
  label: string,
  action: () => Promise<void>
): Promise<NavSample> {
  const documentRequests: string[] = [];
  const navigationRequests: string[] = [];
  const rscRequests: string[] = [];
  const mainFrame = page.mainFrame();

  const onRequest = (req: Request) => {
    const kind = classifyRequest(req, mainFrame);
    if (kind === "document") {
      documentRequests.push(req.url());
    } else if (kind === "navigation") {
      navigationRequests.push(req.url());
    } else if (kind === "rsc") {
      rscRequests.push(req.url());
    }
  };

  page.on("request", onRequest);
  await action();
  await page.waitForTimeout(1_500);
  page.off("request", onRequest);

  return {
    label,
    urlAfter: page.url(),
    documentRequests,
    navigationRequests,
    rscRequests,
  };
}

async function resolveTourId(page: Page): Promise<string> {
  const configured = process.env.QA_TOUR_ID?.trim();
  if (configured !== undefined && configured.length > 0) {
    return configured;
  }
  const res = await page.request.get("/api/tours?limit=1");
  expect(res.ok()).toBeTruthy();
  const body = (await res.json()) as { items?: Array<{ id?: string }> };
  const id = body.items?.[0]?.id?.trim() ?? "";
  expect(id.length).toBeGreaterThan(0);
  return id;
}

/** Wait for workspace shell hydration before tab clicks (domcontentloaded alone is too early). */
async function gotoWorkspaceReady(page: Page, workspacePath: string): Promise<void> {
  await page.goto(workspacePath, { waitUntil: "networkidle" });
  await expect(page.getByTestId(TOUR_WORKSPACE_TEST_IDS.page)).toBeVisible({
    timeout: 90_000,
  });
  await expect(page.getByTestId(TOUR_WORKSPACE_TEST_IDS.subnav)).toBeVisible({
    timeout: 30_000,
  });
}

test.describe("workspace nav instrumentation", () => {
  test("classifies tab vs cross-route navigation requests", async ({ page }) => {
    test.setTimeout(180_000);

    await loginOperatorWithPhone(page, OPERATOR_OWNER_MOBILE, { skipDashboard: true });
    const tourId = await resolveTourId(page);
    const workspacePath = `/tours/${tourId}/workspace`;

    await gotoWorkspaceReady(page, workspacePath);

    const samples: NavSample[] = [];

    samples.push(
      await sampleInteraction(page, "subnav → waitlist", async () => {
        await page.getByTestId(TOUR_WORKSPACE_TEST_IDS.tabWaitlist).click();
        await waitForTabSwitch(page, "waitlist");
      })
    );
    samples.push(
      await sampleInteraction(page, "subnav → transport", async () => {
        await page.getByTestId(TOUR_WORKSPACE_TEST_IDS.tabTransport).click();
        await waitForTabSwitch(page, "transport");
      })
    );

    const financeTab = page.getByTestId(TOUR_WORKSPACE_TEST_IDS.tabFinance);
    if ((await financeTab.count()) > 0) {
      samples.push(
        await sampleInteraction(page, "subnav → finance", async () => {
          await financeTab.click();
          await waitForTabSwitch(page, "finance");
        })
      );
    }

    samples.push(
      await sampleInteraction(page, "subnav → registrations", async () => {
        await page.getByTestId(TOUR_WORKSPACE_TEST_IDS.tabRegistrations).click();
        await waitForTabSwitch(page, "registrations");
      })
    );

    samples.push(
      await sampleInteraction(page, "header → edit tour", async () => {
        await page.getByRole("link", { name: /edit tour|ویرایش تور/i }).click();
        await expect(page).toHaveURL(/\/edit(?:\?|$)/, { timeout: 15_000 });
      })
    );

    await gotoWorkspaceReady(page, workspacePath);

    samples.push(
      await sampleInteraction(page, "header → open command center", async () => {
        await page.getByTestId(TOUR_WORKSPACE_TEST_IDS.openBookings).click();
        await expect(page).toHaveURL(/\/bookings\?.*tourId=/, { timeout: 15_000 });
      })
    );

    await gotoWorkspaceReady(page, workspacePath);

    samples.push(
      await sampleInteraction(page, "legacy segment /workspace/waitlist", async () => {
        await page.goto(`${workspacePath}/waitlist`, { waitUntil: "networkidle" });
        await expect(page).toHaveURL(/tab=waitlist/, { timeout: 15_000 });
      })
    );

    const summary = samples.map((sample) => ({
      label: sample.label,
      urlAfter: sample.urlAfter,
      documentCount: sample.documentRequests.length,
      navigationCount: sample.navigationRequests.length,
      rscCount: sample.rscRequests.length,
      documentRequests: sample.documentRequests,
      navigationRequests: sample.navigationRequests,
    }));

    // eslint-disable-next-line no-console -- instrumentation output for manual QA
    console.log("\n=== WORKSPACE NAV INSTRUMENTATION ===\n", JSON.stringify(summary, null, 2));

    const tabSamples = summary.filter((row) => row.label.startsWith("subnav"));
    for (const row of tabSamples) {
      expect(
        row.documentCount,
        `${row.label} must not trigger a document navigation`
      ).toBe(0);
    }

    const legacy = summary.find((row) => row.label === "legacy segment /workspace/waitlist");
    expect(legacy?.urlAfter).toMatch(/tab=waitlist/);
    expect(
      legacy?.documentCount ?? 99,
      "legacy cold load: middleware 308 + final document (Playwright counts both hops)"
    ).toBeLessThanOrEqual(2);

    const crossRoute = summary.filter((row) =>
      ["header → edit tour", "header → open command center"].includes(row.label)
    );
    for (const row of crossRoute) {
      expect(
        row.documentCount + row.navigationCount + row.rscCount,
        `${row.label} should produce client navigation traffic`
      ).toBeGreaterThan(0);
    }
  });
});
