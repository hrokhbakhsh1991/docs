import {
  expect,
  type BrowserContext,
  type Locator,
  type Page,
  type Route,
} from "@playwright/test";

import {
  WIZARD_DRAFT_STORAGE_KEY_LEGACY,
  wizardDraftStorageKey,
} from "../../src/features/tours/wizard/tourWizardDraftEnvelope";
import { SESSION_TOKEN_COOKIE } from "../../lib/auth/session-cookie";
import { decodeJwtPayload } from "../../lib/auth/decode-jwt-payload";

/** Same key as `lib/auth/session.ts` — axios attaches `Authorization` from sessionStorage for cross-origin API. */
const TOUR_OPS_SESSION_TOKEN_STORAGE_KEY = "tour_ops_session_token";

/** JWT-shaped cookie value; middleware only checks non-empty; BFF decodes `sub` + `tenant_id`. */
/** Default Playwright origin for tour wizard smoke (tenant host label required). */
export const SMOKE_WORKSPACE_BASE_URL = "http://ws1-rbac.localhost:3000";

/** Workspace host slug — matches {@link useWorkspaceDraftScope} / `ws1-rbac.localhost`. */
export const SMOKE_WIZARD_TENANT_SCOPE = "ws1-rbac";

/** JWT `tenant_id` for session mock (API scope); draft keys use slug above. */
export const SMOKE_WIZARD_JWT_TENANT_ID = "00311449-1df0-4413-8d61-26c6ac82e9ed";

export const SMOKE_WIZARD_DRAFT_STORAGE_KEY = wizardDraftStorageKey(SMOKE_WIZARD_TENANT_SCOPE);

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

export const LEADER_SMOKE_SESSION_JWT =
  "smoke." +
  Buffer.from(
    JSON.stringify({
      sub: "user-smoke-1",
      tenant_id: SMOKE_WIZARD_JWT_TENANT_ID,
      role: "owner",
    }),
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

/** Seeds wizard draft JSON on the scoped storage key (after a first navigation cleared legacy keys). */
export async function seedSmokeWizardDraft(page: Page, json: string): Promise<void> {
  await page.evaluate(
    ({ key, payload }: { key: string; payload: string }) => {
      try {
        localStorage.setItem(key, payload);
      } catch {
        /* ignore */
      }
    },
    { key: SMOKE_WIZARD_DRAFT_STORAGE_KEY, payload: json },
  );
}

/** Clears wizard draft keys on the current origin (call after a navigation that established storage). */
export async function purgeTourWizardDraftStorage(page: Page): Promise<void> {
  await page.evaluate(
    ({ legacy, scoped }: { legacy: string; scoped: string }) => {
      try {
        localStorage.removeItem(legacy);
        localStorage.removeItem(scoped);
      } catch {
        /* ignore */
      }
    },
    { legacy: WIZARD_DRAFT_STORAGE_KEY_LEGACY, scoped: SMOKE_WIZARD_DRAFT_STORAGE_KEY },
  );
}

/** Enables server draft restore/sync in smoke without a dedicated production build flag. */
export async function installSmokeServerDraftEnabled(page: Page): Promise<void> {
  const enable = () => {
    window.__TOUR_WIZARD_SERVER_DRAFT__ = true;
  };
  await page.context().addInitScript(enable);
  await page.addInitScript(enable);
}

/** Enables Denali local draft autosave in smoke when the build omits `NEXT_PUBLIC_ENABLE_DENALI_DRAFT`. */
export async function installSmokeDenaliDraftEnabled(page: Page): Promise<void> {
  const enable = () => {
    window.__DENALI_DRAFT__ = true;
  };
  await page.context().addInitScript(enable);
  await page.addInitScript(enable);
}

export async function clearTourWizardLocalDraft(page: Page): Promise<void> {
  // Important: avoid `addInitScript` that deletes on every navigation — smoke tests often seed a
  // draft on one `goto` and navigate again; a per-navigation wipe would delete the seed.
  await page.addInitScript(
    ({ legacy, scoped }: { legacy: string; scoped: string }) => {
      const FLAG = "__tour_wizard_draft_cleared_once_v1";
      try {
        if (sessionStorage.getItem(FLAG) === "1") return;
        sessionStorage.setItem(FLAG, "1");
        localStorage.removeItem(legacy);
        localStorage.removeItem(scoped);
      } catch {
        /* ignore */
      }
    },
    { legacy: WIZARD_DRAFT_STORAGE_KEY_LEGACY, scoped: SMOKE_WIZARD_DRAFT_STORAGE_KEY },
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

/** Waits until membership ability context has hydrated `form_builder` on the wizard shell. */
export async function waitForWizardFormBuilderHydrated(page: Page): Promise<void> {
  await expect(page.getByTestId("tour-create-wizard")).toHaveAttribute(
    "data-tenant-advanced-trip-details",
    "1",
    { timeout: 20_000 },
  );
}

export async function fillTourWizardBasicInfoStep(
  page: Page,
  opts: { title: string; shortDescription: string; longDescription: string },
): Promise<void> {
  const w = page.getByTestId("tour-create-wizard");
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

/** Asserts `data-form-profile` on the wizard shell (workspace template authority). */
export async function expectWizardTemplateProfile(
  page: Page,
  workspaceTemplateProfile: TourWizardSmokeTemplateProfile,
): Promise<void> {
  await expect(page.getByTestId("wizard-form-profile")).toHaveAttribute(
    "data-form-profile",
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
    } catch (err) {
      console.error("[FULFILL TEMPLATE ERROR]", err);
    }
  };

  await page.context().route("**/api/settings/tour-themes", fulfillThemes);
  await page.route("**/api/settings/tour-themes", fulfillThemes);

  await page.context().route("**/api/settings/tour-presets", fulfillPresets);
  await page.route("**/api/settings/tour-presets", fulfillPresets);

  await page.context().route("**/api/settings/tour-wizard-template", fulfillTemplate);
  await page.route("**/api/settings/tour-wizard-template", fulfillTemplate);
}


export type TourWizardServerDraftMock = {
  id?: string;
  envelope: Record<string, unknown>;
  updatedAt: string;
  rowVersion?: number;
  currentStepIndex?: number;
};

/**
 * Mocks BFF `GET/PATCH/DELETE /api/settings/tour-wizard-draft` (requires build with
 * `NEXT_PUBLIC_TOUR_WIZARD_SERVER_DRAFT=1`).
 */
export async function installTourWizardServerDraftRoutes(
  page: Page,
  opts: {
    getDraft?: TourWizardServerDraftMock | null;
    onPatch?: (body: Record<string, unknown>) => void;
  } = {},
): Promise<void> {
  let rowVersion = opts.getDraft?.rowVersion ?? 1;
  const draftId = opts.getDraft?.id ?? "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

  const fulfillDraft = async (route: Route) => {
    const method = route.request().method().toUpperCase();
    if (method === "GET") {
      const draft = opts.getDraft;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          draft: draft
            ? {
                id: draftId,
                workspaceId: SMOKE_WIZARD_JWT_TENANT_ID,
                userId: "user-smoke-1",
                envelope: draft.envelope,
                payload: draft.envelope,
                currentStepIndex: opts.getDraft?.currentStepIndex ?? 0,
                version: draft.rowVersion ?? rowVersion,
                rowVersion: draft.rowVersion ?? rowVersion,
                updatedAt: draft.updatedAt,
              }
            : null,
        }),
      });
      return;
    }
    if (method === "PATCH") {
      let body: Record<string, unknown> = {};
      try {
        body = route.request().postDataJSON() as Record<string, unknown>;
      } catch {
        /* ignore */
      }
      opts.onPatch?.(body);
      rowVersion += 1;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          draft: {
            id: draftId,
            workspaceId: SMOKE_WIZARD_JWT_TENANT_ID,
            userId: "user-smoke-1",
            envelope: (body.envelope as Record<string, unknown>) ?? {},
            payload: (body.payload as Record<string, unknown>) ?? (body.envelope as Record<string, unknown>) ?? {},
            currentStepIndex: (body.currentStepIndex as number) ?? 0,
            version: rowVersion,
            rowVersion,
            updatedAt: new Date().toISOString(),
          },
        }),
      });
      return;
    }
    if (method === "DELETE") {
      await route.fulfill({ status: 204, body: "" });
      return;
    }
    await route.continue();
  };

  await page.context().route("**/api/settings/tour-wizard-draft", fulfillDraft);
  await page.route("**/api/settings/tour-wizard-draft", fulfillDraft);
  await page.context().route("**/api/workspaces/*/tours/drafts", fulfillDraft);
  await page.route("**/api/workspaces/*/tours/drafts", fulfillDraft);
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
    } catch (err) {
      console.error("[FULFILL ABILITY ERROR]", err);
    }
  };

  await page.context().route("**/api/auth/membership-ability-context", fulfillAbility);
  await page.route("**/api/auth/membership-ability-context", fulfillAbility);
}

