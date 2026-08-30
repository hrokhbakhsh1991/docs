/**
 * Denali Settings — shared responsive layout regression (me, branding, integrations).
 */
import { expect, test } from "@playwright/test";

import { BRANDING_SETTINGS_TEST_IDS } from "../src/features/settings/branding-types";
import { SETTINGS_HUB_TEST_IDS } from "../src/features/settings/settings-module-types";
import { loginOperatorOwner } from "./fixtures/operator-owner-session";

const INTEGRATIONS_LIST_TEST_ID = "integrations-settings-list";

const VIEWPORTS = [
  { label: "1440", width: 1440, height: 900 },
  { label: "1024", width: 1024, height: 768 },
  { label: "768", width: 768, height: 1024 },
  { label: "390", width: 390, height: 844 },
] as const;

type RouteCase = {
  readonly slug: string;
  readonly path: string;
  readonly testId: string;
  readonly centeredCard?: boolean;
  readonly gridTestId?: string;
};

const ROUTES: readonly RouteCase[] = [
  {
    slug: "me",
    path: "/settings/me",
    testId: SETTINGS_HUB_TEST_IDS.profilePage,
    centeredCard: true,
  },
  {
    slug: "branding",
    path: "/settings/branding",
    testId: BRANDING_SETTINGS_TEST_IDS.page,
    centeredCard: true,
  },
  {
    slug: "integrations",
    path: "/settings/integrations",
    testId: SETTINGS_HUB_TEST_IDS.integrationsPage,
    gridTestId: INTEGRATIONS_LIST_TEST_ID,
  },
];

async function readPageMetrics(page: import("@playwright/test").Page, testId: string) {
  return page.evaluate((pageTestId) => {
    const doc = document.documentElement;
    const body = document.body;
    const settingsPage = document.querySelector(`[data-testid="${pageTestId}"]`);
    const content = settingsPage?.querySelector("[data-operator-settings-content]");
    const primaryCard = content?.querySelector("[data-operator-surface='card'], .rounded-\\[var\\(--radius\\)\\]");

    function rect(el: Element | null) {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return {
        left: Math.round(r.left),
        right: Math.round(r.right),
        width: Math.round(r.width),
      };
    }

    const listGrid = document.querySelector('[data-testid="integrations-settings-list"]');
    const listButtons = listGrid
      ? [...listGrid.querySelectorAll("button")].map((button) => {
          const r = button.getBoundingClientRect();
          return { width: Math.round(r.width), height: Math.round(r.height) };
        })
      : [];

    const masterDetail = content?.querySelector(".lg\\:grid-cols-2");
    const masterDetailCols = masterDetail
      ? [...masterDetail.children].map((child) => {
          const r = child.getBoundingClientRect();
          return { width: Math.round(r.width) };
        })
      : [];

    return {
      dir: doc.getAttribute("dir"),
      doc: {
        scrollWidth: doc.scrollWidth,
        clientWidth: doc.clientWidth,
        overflow: doc.scrollWidth > doc.clientWidth,
      },
      body: {
        scrollWidth: body.scrollWidth,
        clientWidth: body.clientWidth,
        overflow: body.scrollWidth > body.clientWidth,
      },
      content: rect(content ?? settingsPage),
      primaryCard: rect(primaryCard),
      listButtons,
      masterDetailCols,
    };
  }, testId);
}

for (const route of ROUTES) {
  test.describe(`settings-responsive-${route.slug}`, () => {
    test(`WEB-SETTINGS-RESP-${route.slug} layout @ all breakpoints`, async ({ page }) => {
      await loginOperatorOwner(page);
      await page.goto(route.path, { waitUntil: "networkidle" });
      await expect(page.getByTestId(route.testId)).toBeVisible({ timeout: 20_000 });

      for (const viewport of VIEWPORTS) {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await page.waitForTimeout(200);
        const metrics = await readPageMetrics(page, route.testId);

        expect(metrics.doc.overflow, `${route.slug} doc overflow @ ${viewport.label}`).toBe(
          false
        );
        expect(metrics.body.overflow, `${route.slug} body overflow @ ${viewport.label}`).toBe(
          false
        );

        if (route.centeredCard && metrics.primaryCard && metrics.content) {
          const cardCenter = (metrics.primaryCard.left + metrics.primaryCard.right) / 2;
          const contentCenter = (metrics.content.left + metrics.content.right) / 2;
          expect(
            Math.abs(cardCenter - contentCenter),
            `${route.slug} card center drift @ ${viewport.label}`
          ).toBeLessThan(12);
        }

        if (route.gridTestId && metrics.masterDetailCols.length === 2 && viewport.width >= 1024) {
          const [left, right] = metrics.masterDetailCols;
          expect(left && right, `${route.slug} master-detail columns @ ${viewport.label}`).toBeTruthy();
          if (left && right) {
            expect(
              Math.abs(left.width - right.width),
              `${route.slug} column width delta @ ${viewport.label}`
            ).toBeLessThan(24);
          }
        }

        if (route.gridTestId && metrics.listButtons.length > 1) {
          const widths = metrics.listButtons.map((button) => button.width);
          expect(
            Math.max(...widths) - Math.min(...widths),
            `${route.slug} list button width delta @ ${viewport.label}`
          ).toBeLessThan(8);
        }

        await page.screenshot({
          path: `/opt/cursor/artifacts/settings-${route.slug}-${viewport.label}.png`,
          fullPage: true,
        });
      }
    });
  });
}
