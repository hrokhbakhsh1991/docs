import {
  expect,
  type BrowserContext,
  type Locator,
  type Page,
  type Route,
} from "@playwright/test";

import { SESSION_TOKEN_COOKIE } from "../../../../../lib/auth/session-cookie";
import { buildSessionTokenStorageKey } from "../../../../../lib/auth/session";
import { decodeJwtPayload } from "../../../../../lib/auth/decode-jwt-payload";
import { resolveTenantSlugFromHost } from "../../../../../lib/tenant/runtime-tenant-context";
import {
  buildSmokeSessionJwt,
  LEADER_SMOKE_SESSION_JWT,
  SMOKE_WIZARD_JWT_TENANT_ID,
} from "../../../../../lib/test/session-fixtures";
import {
  resolveTestPlatformBaseUrl,
  resolveTestPlatformHostLabel,
} from "../../../../../lib/test/smoke-platform-url";
import {
  buildDenaliTourCreateTestValues,
  type DenaliCreateTourWizardForm,
} from "@/features/tours/testing/public-test-api";

export { SMOKE_WIZARD_JWT_TENANT_ID };

/** Wave 4 workspace shell root (`WorkspaceTourWizard`). */
export const SMOKE_WIZARD_SHELL_TEST_ID = "workspace-tour-wizard";

/** Default Playwright origin for tour wizard smoke (tenant host label required). */
export const SMOKE_WORKSPACE_BASE_URL = resolveTestPlatformBaseUrl();

/** Workspace host slug for smoke tests (derived from {@link SMOKE_WORKSPACE_BASE_URL}). */
export const SMOKE_WIZARD_TENANT_SCOPE = resolveTestPlatformHostLabel();

/** Loopback e2e profile seed (`TourCreateWizard` reads `?e2eTourType=` on localhost hosts). */
export const SMOKE_WIZARD_URBAN_E2E_QUERY = "e2eTourType=city";

export function smokeTourWizardNewUrl(
  baseURL: string,
  query?: string,
): string {
  const path = query ? `/tours/new?${query}` : "/tours/new";
  return `${baseURL.replace(/\/$/, "")}${path}`;
}

/** Seeds `overview.tourType` before React paint (pairs with `?e2eTourType=` on loopback hosts). */
export async function installUrbanWizardE2eSeed(page: Page): Promise<void> {
  await page.addInitScript(() => {
    (window as unknown as { __E2E_SEED_TOUR_TYPE?: string }).__E2E_SEED_TOUR_TYPE = "city";
  });
}

/** In-browser fetch stub (works when Playwright routing misses standalone chunk requests). */
export async function installCloneTourFetchMock(
  context: BrowserContext,
  tourId: string,
  body: Record<string, unknown>,
): Promise<void> {
  await context.addInitScript(
    ({ id, payload }: { id: string; payload: Record<string, unknown> }) => {
      const path = `/api/tours/${id}`;
      const orig = globalThis.fetch.bind(globalThis);
      globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        const href = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
        if (href.includes(path)) {
          return new Response(JSON.stringify(payload), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        return orig(input, init);
      };
    },
    { id: tourId, payload: body },
  );
}

export async function installCloneTourGetRoute(
  context: BrowserContext,
  page: Page,
  tourId: string,
  body: Record<string, unknown>,
): Promise<void> {
  await installCloneTourFetchMock(context, tourId, body);
  const pathSuffix = `/api/tours/${tourId}`;
  const fulfillClone = async (route: Route) => {
    const reqUrl = route.request().url();
    if (route.request().method() !== "GET" || !reqUrl.includes(pathSuffix)) {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  };
  await context.route("**/api/tours/**", fulfillClone);
  await page.route("**/api/tours/**", fulfillClone);
}

export { LEADER_SMOKE_SESSION_JWT, buildSmokeSessionJwt };

/** Isolated workspace ids for draft tenant-scope smoke tests (Phase A). */
export const SMOKE_DENALI_DRAFT_WORKSPACE_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
export const SMOKE_DENALI_DRAFT_WORKSPACE_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

export async function addLeaderSmokeSessionCookie(
  context: BrowserContext,
  baseURL: string,
  jwt: string = LEADER_SMOKE_SESSION_JWT,
): Promise<void> {
  await context.addCookies([
    {
      name: SESSION_TOKEN_COOKIE,
      value: jwt,
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
  const hostname = new URL(SMOKE_WORKSPACE_BASE_URL).hostname;
  const slug = resolveTenantSlugFromHost(hostname);
  const key = buildSessionTokenStorageKey(slug ?? undefined, jwt);
  await page.addInitScript(
    ({ storageKey, token }: { storageKey: string; token: string }) => {
      try {
        localStorage.setItem(storageKey, token);
      } catch {
        /* ignore */
      }
    },
    { storageKey: key, token: jwt },
  );
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

async function fillRhfControl(locator: Locator, value: string): Promise<void> {
  await locator.fill(value);
  await locator.dispatchEvent("input");
  await locator.dispatchEvent("change");
}

/** Waits until the workspace wizard shell is hydrated for classic stepper smoke flows. */
export async function waitForWizardFormBuilderHydrated(page: Page): Promise<void> {
  await expect(page.getByTestId(SMOKE_WIZARD_SHELL_TEST_ID)).toBeVisible({ timeout: 20_000 });
}

export async function fillTourWizardBasicInfoStep(
  page: Page,
  opts: { title: string; shortDescription: string; longDescription: string },
): Promise<void> {
  const w = page.getByTestId(SMOKE_WIZARD_SHELL_TEST_ID);
  await waitForWizardFormBuilderHydrated(page);
  const fields = [
    { locator: w.locator('input[name="overview.title"]'), value: opts.title },
    { locator: w.locator('textarea[name="overview.shortDescription"]'), value: opts.shortDescription },
    { locator: w.locator('textarea[name="overview.longDescription"]'), value: opts.longDescription },
  ] as const;
  for (const { locator, value } of fields) {
    await fillRhfControl(locator, value);
    await expect(locator).toHaveValue(value, { timeout: 8_000 });
  }
}

export type TourWizardSmokeTemplateProfile =
  | "general"
  | "mountain_outdoor"
  | "nature_trip"
  | "urban_event"
  | "cinema_event"
  | "cultural_tour"
  | "denali_pilot";

/**
 * Default `baseProfile` when smoke tests do not override `workspaceTemplateProfile`.
 * Matches typical ws1-rbac urban workspace and avoids client fallback to `general`.
 */
export const SMOKE_DEFAULT_WORKSPACE_TEMPLATE_PROFILE: TourWizardSmokeTemplateProfile = "urban_event";

/** Minimal workspace template envelope for smoke (`useTenantWizardTemplate`). */
export function buildSmokeWizardTemplateEnvelope(baseProfile: TourWizardSmokeTemplateProfile): {
  template: Record<string, unknown>;
} {
  return {
    template: {
      id: "11111111-1111-4111-8111-111111111111",
      workspaceId: SMOKE_WIZARD_JWT_TENANT_ID,
      baseProfile,
      stepOverrides: { skip: [], insert: [] },
      fieldRulesOverlay: {},
      presetId: null,
      wizardContractVersion: 1,
      formProfileVersion: 1,
    },
  };
}

/** Asserts workspace template profile on the wizard shell (template authority). */
export async function expectWizardTemplateProfile(
  page: Page,
  workspaceTemplateProfile: TourWizardSmokeTemplateProfile,
): Promise<void> {
  await expect(page.getByTestId(SMOKE_WIZARD_SHELL_TEST_ID)).toHaveAttribute(
    "data-resolved-form-profile",
    workspaceTemplateProfile,
    { timeout: 20_000 },
  );
}

export type TourWizardSmokeRoutesOptions = {
  themes?: unknown[];
  presets?: unknown[];
  /**
   * Mocks `GET /api/settings/tour-wizard-template` `baseProfile`.
   * Omit to use {@link SMOKE_DEFAULT_WORKSPACE_TEMPLATE_PROFILE} (`urban_event`).
   * Pass `null` for `{ template: null }` (client falls back to `general`).
   */
  workspaceTemplateProfile?: TourWizardSmokeTemplateProfile | null;
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

  const fulfillThemes = async (route: Route) => {
    if (route.request().method() !== "GET") {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(themes),
    });
  };

  const fulfillPresets = async (route: Route) => {
    if (route.request().method() !== "GET") {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(presets),
    });
  };

  const fulfillTemplate = async (route: Route) => {
    try {
      if (route.request().method() !== "GET") {
        await route.continue();
        return;
      }
      const profile =
        opts.workspaceTemplateProfile === null
          ? null
          : opts.workspaceTemplateProfile ?? SMOKE_DEFAULT_WORKSPACE_TEMPLATE_PROFILE;
      const body =
        profile != null ? buildSmokeWizardTemplateEnvelope(profile) : { template: null };
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(body),
      });
    } catch {
      /* route handler best-effort; Playwright may abort in-flight fulfill */
    }
  };

  await page.context().route("**/api/settings/tour-themes", fulfillThemes);
  await page.route("**/api/settings/tour-themes", fulfillThemes);

  await page.context().route("**/api/settings/tour-presets", fulfillPresets);
  await page.route("**/api/settings/tour-presets", fulfillPresets);

  await page.context().route("**/api/settings/tour-wizard-template", fulfillTemplate);
  await page.route("**/api/settings/tour-wizard-template", fulfillTemplate);
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
  opts?: { tenantModules?: string[] },
): Promise<void> {
  const claims = decodeJwtPayload(jwt);
  const userId = typeof claims?.sub === "string" ? claims.sub.trim() : "user-smoke-1";
  const tenantId =
    typeof claims?.tenant_id === "string" ? claims.tenant_id.trim() : SMOKE_WIZARD_JWT_TENANT_ID;
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
  await page.route("**/api/auth/session", fulfill);
  await installSmokeMembershipAbilityContext(page, opts?.tenantModules ?? ["form_builder"]);
}

/** Enables advanced wizard steps (itinerary / participation / logistics) in smoke. */
export async function installSmokeMembershipAbilityContext(
  page: Page,
  tenantModules: string[] = ["form_builder"],
): Promise<void> {
  const fulfillAbility = async (route: Route) => {
    try {
      if (route.request().method() !== "GET") {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          labels: ["owner"],
          capabilities: [],
          tenant_modules: tenantModules,
        }),
      });
    } catch {
      /* route handler best-effort; Playwright may abort in-flight fulfill */
    }
  };

  await page.context().route("**/api/auth/membership-ability-context", fulfillAbility);
  await page.route("**/api/auth/membership-ability-context", fulfillAbility);
}

type ScopedDraftStoreEntry = {
  data: unknown;
  version: number;
  schemaVersion: number;
  lastModified: number;
};

/** In-memory draft-engine mock keyed by workspace id (tenant isolation smoke). */
export async function installScopedDraftEngineRoutes(
  context: BrowserContext,
  opts?: { draftKey?: string },
): Promise<{ store: Map<string, ScopedDraftStoreEntry>; fetchUrls: string[] }> {
  const draftKey = opts?.draftKey ?? "denali-create";
  const store = new Map<string, ScopedDraftStoreEntry>();
  const fetchUrls: string[] = [];

  const handler = async (route: Route) => {
    const url = route.request().url();
    const match = url.match(/\/api\/workspaces\/([^/]+)\/draft-engine\/([^/?]+)/);
    if (!match) {
      await route.continue();
      return;
    }
    const [, workspaceId, key] = match;
    if (key !== draftKey) {
      await route.continue();
      return;
    }

    const method = route.request().method();
    if (method === "GET") {
      fetchUrls.push(url);
      const entry = store.get(workspaceId);
      if (!entry) {
        await route.fulfill({
          status: 404,
          contentType: "application/json",
          body: JSON.stringify({ error: "not_found" }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(entry),
      });
      return;
    }

    if (method === "PATCH") {
      fetchUrls.push(url);
      const body = JSON.parse(route.request().postData() ?? "{}") as {
        data?: unknown;
        version?: number;
        schemaVersion?: number;
        lastModified?: number;
      };
      const current = store.get(workspaceId);
      const requestedVersion = body.version ?? 0;
      if (current && requestedVersion !== current.version) {
        await route.fulfill({
          status: 409,
          contentType: "application/json",
          body: JSON.stringify({
            error: {
              code: "DRAFT_CONFLICT",
              details: { server: current },
            },
          }),
        });
        return;
      }
      const next: ScopedDraftStoreEntry = {
        data: body.data ?? {},
        version: (current?.version ?? 0) + 1,
        schemaVersion: body.schemaVersion ?? 1,
        lastModified: body.lastModified ?? Date.now(),
      };
      store.set(workspaceId, next);
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(next),
      });
      return;
    }

    await route.continue();
  };

  await context.route("**/api/workspaces/**/draft-engine/**", handler);
  return { store, fetchUrls };
}

export async function requireDenaliWizard(page: Page): Promise<Locator> {
  const denali = page.getByTestId("workspace-tour-wizard");
  if (!(await denali.isVisible().catch(() => false))) {
    throw new Error("Denali wizard not available on this host (must be a Denali tenant subdomain)");
  }
  return denali;
}

/** Clicks restore when `autoApply: false` leaves a pending server draft after reload. */
export async function restoreDenaliDraftAfterReload(page: Page): Promise<void> {
  const banner = page.getByTestId("workspace-draft-restore-banner");
  if (await banner.isVisible().catch(() => false)) {
    await page.getByTestId("workspace-draft-restore-load").click();
  }
}

export const denaliWizardNextButton = (page: Page) =>
  page.getByRole("button", { name: /بعدی|next/i });

export const denaliWizardBackButton = (page: Page) =>
  page.getByRole("button", { name: /قبلی|previous|back/i });

export async function advanceDenaliWizardToStep(page: Page, stepTestId: string): Promise<void> {
  const target = page.getByTestId(stepTestId);
  const next = denaliWizardNextButton(page);
  for (let attempt = 0; attempt < 6; attempt += 1) {
    if (await target.isVisible().catch(() => false)) {
      return;
    }
    await next.click();
    await target.waitFor({ state: "visible", timeout: 15_000 }).catch(() => undefined);
  }
  await expect(target).toBeVisible({ timeout: 15_000 });
}

export async function fillDenaliMountainBasicsForNavigation(page: Page): Promise<void> {
  const w = page.getByTestId("workspace-tour-wizard");
  await setNativeSelectValue(w.getByTestId("denali-basics-category"), "mountain");
  await setNativeSelectValue(w.getByTestId("denali-basics-duration"), "single_day");
}

export function denaliTitleInput(page: Page): Locator {
  return page.getByTestId("denali-step-basics").getByRole("textbox").first();
}

export async function fillDenaliTitle(page: Page, title: string): Promise<void> {
  const input = denaliTitleInput(page);
  await input.fill(title);
  await input.dispatchEvent("input");
  await input.dispatchEvent("change");
}

export async function fillDenaliShortDescription(page: Page, text: string): Promise<void> {
  const field = page.locator('[data-field-path="programNature.shortDescription"]');
  await field.fill(text);
  await field.dispatchEvent("input");
  await field.dispatchEvent("change");
}

export async function applyDenaliWizardIntegrationPatch(
  page: Page,
  patch: Partial<DenaliCreateTourWizardForm> = {},
): Promise<void> {
  const values = {
    ...buildDenaliTourCreateTestValues(),
    ...patch,
    basicInfo: {
      ...buildDenaliTourCreateTestValues().basicInfo,
      ...(patch.basicInfo ?? {}),
    },
    programNature: {
      ...buildDenaliTourCreateTestValues().programNature,
      ...(patch.programNature ?? {}),
    },
  };

  await page.evaluate((payload) => {
    const bridge = (
      window as Window & {
        __integrationApplyDenaliWizardPatch?: (_p: unknown) => void;
      }
    ).__integrationApplyDenaliWizardPatch;
    if (!bridge) {
      throw new Error("__integrationApplyDenaliWizardPatch unavailable (localhost only)");
    }
    bridge(payload);
  }, values);
}

export async function installDenaliVerificationMatrixSetup(
  page: Page,
  context: BrowserContext,
  opts?: {
    tenantId?: string;
    workspaceTemplateProfile?: TourWizardSmokeTemplateProfile;
    baseURL?: string;
    draftRoutes?: boolean;
  },
): Promise<void> {
  const baseURL = opts?.baseURL ?? process.env.PW_BASE_URL ?? SMOKE_WORKSPACE_BASE_URL;
  if (opts?.draftRoutes === true) {
    await installScopedDraftEngineRoutes(context);
  }
  const tenantId = opts?.tenantId ?? SMOKE_WIZARD_JWT_TENANT_ID;
  const jwt = buildSmokeSessionJwt(tenantId);
  await installUrbanWizardE2eSeed(page);
  await installLeaderWorkspaceSessionRoute(page, jwt);
  await installSmokeTourOpsSessionToken(page, jwt);
  await addLeaderSmokeSessionCookie(context, baseURL, jwt);
  await installTourWizardSettingsRoutes(page, {
    workspaceTemplateProfile: opts?.workspaceTemplateProfile ?? "denali_pilot",
  });
}

export async function waitForDenaliDraftEngineInitialized(page: Page): Promise<void> {
  await page.waitForFunction(
    () => {
      const root = document.querySelector('[data-testid="workspace-tour-wizard"]');
      if (!root) {
        return false;
      }

      const w = window as Window & {
        __integrationApplyDenaliWizardPatch?: (_patch: unknown) => void;
      };
      const integrationBridgeReady = typeof w.__integrationApplyDenaliWizardPatch === "function";
      if (!integrationBridgeReady) {
        return false;
      }

      // Draft engine is considered initialized when the wizard shell is mounted and no
      // transient draft-state banners are blocking hydration.
      const restoreBanner = document.querySelector('[data-testid="workspace-draft-restore-banner"]');
      const staleNotice = document.querySelector('[data-testid="workspace-draft-stale-notice"]');
      const saveError = document.querySelector('[data-testid="workspace-draft-save-error"]');
      const hasBlockingDraftUi = Boolean(restoreBanner || staleNotice || saveError);
      return !hasBlockingDraftUi;
    },
    { timeout: 20_000, polling: 200 },
  );
}

export async function waitForDenaliWizardAuthHydrated(page: Page): Promise<void> {
  await page
    .waitForResponse(
      (response) =>
        response.url().includes("/api/auth/session") &&
        response.request().method() === "GET" &&
        response.status() === 200,
      { timeout: 20_000 },
    )
    .catch(() => undefined);
}

export function waitForDraftPatchAttempt(page: Page, draftKey = "denali-create") {
  return page.waitForResponse(
    (response) => {
      if (response.request().method() !== "PATCH") {
        return false;
      }
      const pathname = new URL(response.url()).pathname;
      const match = pathname.match(/\/api\/workspaces\/[^/]+\/draft-engine\/([^/]+)/);
      return match?.[1] === draftKey;
    },
    { timeout: 15_000 },
  );
}

export function waitForDraftPatch(page: Page, status = 200, draftKey = "denali-create") {
  return page.waitForResponse(
    (response) => {
      if (response.request().method() !== "PATCH" || response.status() !== status) {
        return false;
      }
      const pathname = new URL(response.url()).pathname;
      const match = pathname.match(/\/api\/workspaces\/[^/]+\/draft-engine\/([^/]+)/);
      return match?.[1] === draftKey;
    },
    { timeout: 15_000 },
  );
}

export function waitForDraftConflictPatch(page: Page) {
  return waitForDraftPatch(page, 409);
}

