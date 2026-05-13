import { expect, type BrowserContext, type Locator, type Page, type Route } from "@playwright/test";

import { SESSION_TOKEN_COOKIE } from "../../lib/auth/session-cookie";
import { decodeJwtPayload } from "../../lib/auth/decode-jwt-payload";

/** Same key as `lib/auth/session.ts` — axios attaches `Authorization` from sessionStorage for cross-origin API. */
const TOUR_OPS_SESSION_TOKEN_STORAGE_KEY = "tour_ops_session_token";

/** JWT-shaped cookie value; middleware only checks non-empty; BFF decodes `sub` + `tenant_id`. */
export const LEADER_SMOKE_SESSION_JWT =
  "smoke." +
  Buffer.from(
    JSON.stringify({ sub: "user-smoke-1", tenant_id: "tenant-smoke-1", role: "owner" }),
  ).toString("base64url") +
  ".sig";

export async function addLeaderSmokeSessionCookie(context: BrowserContext, baseURL: string): Promise<void> {
  await context.addCookies([
    {
      name: SESSION_TOKEN_COOKIE,
      value: LEADER_SMOKE_SESSION_JWT,
      url: baseURL,
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
}

/**
 * Mirrors the browser token copy used by `apiClient` so Playwright can intercept
 * cross-origin Tour-Ops requests (the session cookie is not sent to another origin).
 */
export async function installSmokeTourOpsSessionToken(page: Page, jwt: string = LEADER_SMOKE_SESSION_JWT): Promise<void> {
  await page.addInitScript(
    ({ key, token }: { key: string; token: string }) => {
      try {
        sessionStorage.setItem(key, token);
      } catch {
        /* ignore */
      }
    },
    { key: TOUR_OPS_SESSION_TOKEN_STORAGE_KEY, token: jwt },
  );
}

export async function clearTourWizardLocalDraft(page: Page): Promise<void> {
  // Important: avoid `addInitScript` that deletes on every navigation — smoke tests often seed a
  // draft on one `goto` and navigate again; a per-navigation wipe would delete the seed.
  await page.addInitScript(() => {
    const KEY = "tour-create-wizard-draft-v1";
    const FLAG = "__tour_wizard_draft_cleared_once_v1";
    try {
      if (sessionStorage.getItem(FLAG) === "1") return;
      sessionStorage.setItem(FLAG, "1");
      localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
  });
}

/** Stable targets: `register` / `Controller` set `name` on native controls inside the wizard card. */
/**
 * Sets a native `<select>` value and dispatches `input`/`change` so React Hook Form `Controller`
 * observers see updates (Playwright `selectOption` can be flaky on wrapped controls in prod builds).
 */
export async function setNativeSelectValue(locator: Locator, value: string): Promise<void> {
  await locator.evaluate(
    (select: HTMLSelectElement, v: string) => {
      select.value = v;
      select.dispatchEvent(new Event("input", { bubbles: true }));
      select.dispatchEvent(new Event("change", { bubbles: true }));
    },
    value,
  );
}

export async function fillTourWizardBasicInfoStep(
  page: Page,
  opts: { title: string; shortDescription: string; longDescription: string },
): Promise<void> {
  const w = page.getByTestId("tour-create-wizard");
  await w.locator('input[name="overview.title"]').fill(opts.title);
  await w.locator('textarea[name="overview.shortDescription"]').fill(opts.shortDescription);
  await w.locator('textarea[name="overview.longDescription"]').fill(opts.longDescription);
  await expect(w.locator('input[name="overview.title"]')).toHaveValue(opts.title);
  await expect(w.locator('textarea[name="overview.shortDescription"]')).toHaveValue(opts.shortDescription);
  await expect(w.locator('textarea[name="overview.longDescription"]')).toHaveValue(opts.longDescription);
}

export type TourWizardSmokeRoutesOptions = {
  themes?: unknown[];
  presets?: unknown[];
};

/**
 * Mocks BFF settings used by `TourCreateWizard` (`useSettingsTourThemes` / `useSettingsTourPresets`).
 */
export async function installTourWizardSettingsRoutes(
  page: Page,
  opts: TourWizardSmokeRoutesOptions = {},
): Promise<void> {
  const themes = opts.themes ?? [];
  const presets = opts.presets ?? [];

  await page.route("**/api/settings/tour-themes", async (route) => {
    if (route.request().method() !== "GET") {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(themes),
    });
  });

  await page.route("**/api/settings/tour-presets", async (route) => {
    if (route.request().method() !== "GET") {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(presets),
    });
  });
}

/** Minimal active region + destination for `LocationDatesStep` / `useTourDestinations`. */
export async function installTourWizardRegionsAndDestinationsRoutes(page: Page): Promise<void> {
  const regionId = "44444444-4444-4444-8444-444444444444";
  await page.route("**/api/settings/regions", async (route) => {
    if (route.request().method() !== "GET") {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        {
          id: regionId,
          name: "منطقهٔ تست",
          country: null,
          sortOrder: 0,
          isActive: true,
        },
      ]),
    });
  });

  await page.route("**/api/settings/destinations", async (route) => {
    if (route.request().method() !== "GET") {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        {
          id: "55555555-5555-4555-8555-555555555555",
          name: "مقصد تست",
          regionId,
          type: null,
          altitudeM: null,
          sortOrder: 0,
          isActive: true,
        },
      ]),
    });
  });
}

/**
 * Stubs `GET /api/auth/session` to return immediately with a leader-shaped user payload.
 *
 * Production pages gate data fetching on `useAuth().isHydrated`, which only flips true after this
 * fetch settles. Stubbing avoids hangs in Playwright and lets us include `user.role` for leader routes.
 */
export async function installLeaderWorkspaceSessionRoute(
  page: Page,
  jwt: string = LEADER_SMOKE_SESSION_JWT,
): Promise<void> {
  const claims = decodeJwtPayload(jwt);
  const userId = typeof claims?.sub === "string" ? claims.sub.trim() : "user-smoke-1";
  const tenantId = typeof claims?.tenant_id === "string" ? claims.tenant_id.trim() : "tenant-smoke-1";
  const role = typeof claims?.role === "string" ? claims.role.trim() : "owner";

  const fulfill = async (route: Route) => {
    if (route.request().method() !== "GET") {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        authenticated: true,
        session_token: jwt,
        user_id: userId,
        tenant_id: tenantId,
        user: { userId, tenantId, role },
      }),
    });
  };

  await page.context().route("**/api/auth/session", fulfill);
}
