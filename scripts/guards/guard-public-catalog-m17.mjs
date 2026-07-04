#!/usr/bin/env node
/**
 * M17 public catalog OTP — fast static closure guard.
 * @see docs/workspaces/denali/public-catalog.md
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const failures = [];
let checksPassed = 0;

function read(rel) {
  return fs.readFileSync(path.join(REPO_ROOT, rel), "utf8");
}

function exists(rel) {
  return fs.existsSync(path.join(REPO_ROOT, rel));
}

function assertCheck(name, ok, detail) {
  if (!ok) {
    failures.push(`${name}: ${detail}`);
    console.error(`FAIL ${name}: ${detail}`);
    return;
  }
  checksPassed += 1;
  console.log(`PASS ${name}`);
}

const REQUIRED_FILES = [
  "apps/api/src/identity/public-auth.routes.ts",
  "apps/api/src/openapi/public-auth-openapi.ts",
  "apps/api/test/public-auth.spec.ts",
  "apps/portal/app/catalog/[tourId]/register/public-catalog-registration-flow.tsx",
  "apps/portal/app/api/catalog/registrations/route.ts",
  "apps/portal/playwright.portal.config.ts",
  "apps/portal/tests/e2e/portal-registration-smoke.spec.ts",
  "apps/portal/tests/e2e/fixtures/catalog-registration-otp.ts",
  "apps/web/app/(public)/catalog/[tourId]/register/page.tsx",
  "apps/web/src/portal/resolve-portal-registration-redirect.ts",
  "apps/marketing/tests/e2e/marketing-catalog-smoke.spec.ts",
  "apps/marketing/tests/e2e/marketing-home-smoke.spec.ts",
  "apps/marketing/tests/e2e/marketing-urban-catalog-smoke.spec.ts",
  "apps/marketing/tests/e2e/marketing-seo-jsonld.spec.ts",
  "apps/marketing/tests/e2e/marketing-seo-head.spec.ts",
  "apps/marketing/tests/e2e/marketing-seo-sitemap.spec.ts",
  "apps/marketing/tests/e2e/marketing-seo-hreflang.spec.ts",
  "apps/marketing/tests/e2e/marketing-seo-pagination.spec.ts",
  "apps/marketing/playwright.marketing-seo.config.ts",
  "docs/dev/guest-seo-conformance.md",
  "docs/dev/guest-seo-e2e-hooks.yaml",
  "docs/dev/adr-guest-plugin/ADR-GP-004-guest-seo-manifest.md",
  "packages/workspace-sdk/src/catalog/resolve-guest-seo-for-plugin.ts",
  "packages/workspace-sdk/src/catalog/workspace-guest-seo.generated.ts",
  "scripts/guards/guard-guest-seo.mjs",
  "scripts/guards/guard-guest-seo-e2e-hooks.mjs",
  "scripts/guards/guard-marketing-semantic-seo.mjs",
  "scripts/guards/guard-marketing-seo-prod.mjs",
  "scripts/guards/guard-marketing-meta-quality.mjs",
  "scripts/guards/guard-marketing-sitemap-host.mjs",
  "scripts/guards/guard-marketing-hreflang.mjs",
  "scripts/guards/guard-marketing-home-hooks.mjs",
  "scripts/guards/guard-jsonld-xss.mjs",
  "scripts/crawl-marketing-sitemap.mjs",
  "apps/marketing/scripts/smoke-marketing-lighthouse-servers.mjs",
  "apps/marketing/public/icon.svg",
  "apps/web/test/web-catalog-seo-redirect.spec.ts",
  "scripts/validate-json-ld.mjs",
  "apps/marketing/lighthouserc.json",
  "apps/marketing/lighthouserc.strict.json",
  "apps/marketing/playwright.marketing-urban.config.ts",
  "apps/marketing/playwright.marketing-home.config.ts",
  "apps/marketing/scripts/smoke-marketing-urban-e2e-servers.mjs",
  "apps/api/src/exposure/resolve-denali-surface-exposure.ts",
  "apps/api/src/exposure/resolve-urban-surface-exposure.ts",
  "packages/workspace-sdk/src/catalog/resolve-catalog-list-features.ts",
  "packages/workspace-sdk/src/catalog/resolve-catalog-detail-sections.ts",
  "packages/workspace-sdk/src/catalog/resolve-catalog-registration-support.ts",
  "packages/workspace-sdk/test/resolve-catalog-list-features.spec.ts",
  "packages/workspace-sdk/test/resolve-catalog-detail-sections.spec.ts",
  "packages/workspace-sdk/test/resolve-catalog-registration-support.spec.ts",
  "packages/workspaces/urban/theme/urban-marketing.css",
  "packages/workspaces/urban/src/catalog/urban-catalog-exposure-bindings.ts",
  "docs/workspaces/denali/public-catalog.md",
  "docs/workspaces/denali/marketing-catalog-ui.md",
  "docs/workspaces/denali/portal-registration-ui.md",
  "docs/phase-19/platform-portal-registration-intake.mdoc",
  "packages/workspace-sdk/src/catalog/build-catalog-registration-upstream-request.ts",
  "packages/workspace-sdk/src/catalog/resolve-catalog-registration-api-path.ts",
  "packages/workspace-sdk/src/catalog/catalog-intake-transport-surface.ts",
  "packages/workspace-sdk/src/catalog/public-catalog-transport-intake.ts",
  "packages/workspaces/denali/src/catalog/denali-catalog-transport-intake.ts",
  "packages/workspaces/denali/src/catalog/registration-flow/denali-registration-flow.steps.tsx",
  "packages/workspaces/denali/test/denali-catalog-transport-intake.spec.ts",
  "packages/workspace-sdk/test/registration-intake.contract.spec.ts",
  "apps/api/src/openapi/denali-catalog-openapi.ts",
  "apps/api/test/denali-registration.spec.ts",
  "apps/api/test/platform-club-product-exit.spec.ts",
  "apps/api/test/identity-me.spec.ts",
  "apps/portal/app/me/profile/member-profile-form.tsx",
  "apps/web/test/format-registration-intake.spec.ts",
  "scripts/p4-club-product-gate.sh",
  "scripts/p6-denali-product-gate.sh",
  "packages/workspaces/denali/test/resolve-denali-registration-transport.spec.ts",
  "packages/workspaces/denali/test/denali-registration-validation.spec.ts",
  "apps/marketing/.env.local.example",
  "apps/portal/.env.local.example",
  "packages/guest-surface-host/src/resolve-tour-ops-api-base-url.ts",
  "packages/guest-surface-host/test/resolve-tour-ops-api-base-url.spec.ts",
  "packages/workspaces/denali/theme/denali-portal.css",
  "design-system/denali-club/MASTER.md",
];

for (const rel of REQUIRED_FILES) {
  assertCheck(`m17_file_${path.basename(rel)}`, exists(rel), `missing ${rel}`);
}

const PORTAL_BFF_ROUTES = [
  "apps/portal/app/api/public-auth/phone-preflight/route.ts",
  "apps/portal/app/api/public-auth/request-otp/route.ts",
  "apps/portal/app/api/public-auth/verify-otp/route.ts",
  "apps/portal/app/api/public-auth/register-complete/route.ts",
  "apps/portal/app/api/public-auth/logout/route.ts",
  "apps/portal/app/api/me/profile/route.ts",
];

for (const rel of PORTAL_BFF_ROUTES) {
  assertCheck(`m17_portal_bff_${path.basename(path.dirname(rel))}`, exists(rel), `missing ${rel}`);
}

const dispatch = read("apps/api/src/openapi/dispatch-routes.ts");
for (const route of [
  "/public/auth/phone-preflight",
  "/public/auth/request-otp",
  "/public/auth/verify-otp",
  "/public/auth/register/complete",
]) {
  assertCheck(`m17_dispatch_${route}`, dispatch.includes(route), `dispatch-routes missing ${route}`);
}

const openapiOverrides = read("apps/api/src/openapi/public-auth-openapi.ts");
for (const op of [
  "publicPhonePreflight",
  "publicRequestOtp",
  "publicVerifyOtp",
  "publicRegisterComplete",
]) {
  assertCheck(`m17_openapi_${op}`, openapiOverrides.includes(op), `public-auth-openapi missing ${op}`);
}

const webRegisterRedirect = read("apps/web/app/(public)/catalog/[tourId]/register/page.tsx");
assertCheck(
  "m17_web_register_redirects_to_portal",
  webRegisterRedirect.includes("resolvePortalRegistrationRedirectUrl"),
  "web /catalog/.../register must redirect to apps/portal (DEC-P11-014)"
);

const portalRegisterPage = read("apps/portal/app/catalog/[tourId]/register/page.tsx");
assertCheck(
  "m17_portal_register_bootstrap",
  portalRegisterPage.includes("resolvePortalBootstrapForHost"),
  "portal /catalog/.../register must resolve tenant bootstrap"
);

const portalVerifyOtpBff = read("apps/portal/app/api/public-auth/verify-otp/route.ts");
assertCheck(
  "m17_portal_verify_otp_sets_session_cookie",
  portalVerifyOtpBff.includes("setSessionCookieOnResponse"),
  "portal verify-otp BFF must set session cookie on success"
);

const portalRegistrations = read("apps/portal/app/api/catalog/registrations/route.ts");
assertCheck(
  "m17_portal_intake_denali_and_urban",
  portalRegistrations.includes("buildCatalogRegistrationUpstreamRequest") &&
    read("packages/workspace-sdk/src/catalog/build-catalog-registration-upstream-request.ts").includes(
      "getWorkspaceIntakePlugin"
    ) &&
    read("packages/workspace-sdk/src/catalog/build-catalog-registration-upstream-request.ts").includes(
      "buildUpstreamRequest"
    ) &&
    read("packages/workspaces/denali/src/catalog/denali-catalog-intake.ts").includes(
      "buildDenaliContactV1"
    ) &&
    read("packages/workspaces/urban/src/catalog/urban-catalog-intake.ts").includes(
      "buildUpstreamRequest"
    ),
  "portal catalog registrations BFF must dispatch via SDK plugin registry for denali + urban"
);

assertCheck(
  "m17_denali_marketing_skin_master_tokens",
  read("packages/workspaces/denali/theme/denali-marketing.css").includes("#059669") &&
    read("packages/workspaces/denali/theme/denali-marketing.css").includes("denali-club/MASTER.md"),
  "denali-marketing.css must map denali-club MASTER tokens",
);

assertCheck(
  "m17_denali_portal_skin_master_tokens",
  read("packages/workspaces/denali/theme/denali-portal.css").includes("#059669") &&
    read("packages/workspaces/denali/theme/denali-portal.css").includes("denali-club/MASTER.md"),
  "denali-portal.css must map denali-club MASTER tokens",
);

const portalRegistrationDoc = read("docs/workspaces/denali/portal-registration-ui.md");
assertCheck(
  "m17_portal_registration_ui_doc",
  portalRegistrationDoc.includes("data-public-registration-success") &&
    portalRegistrationDoc.includes("SMK-PTL-01"),
  "portal-registration-ui.md must document registration hooks and SMK-PTL-01",
);

const portalNextConfig = read("apps/portal/next.config.ts");
assertCheck(
  "m17_portal_allowed_dev_origins",
  portalNextConfig.includes("allowedDevOrigins") &&
    portalNextConfig.includes("*.portal.localhost"),
  "portal next.config must allow *.portal.localhost for Playwright smokes",
);

const publicCatalogDoc = read("docs/workspaces/denali/public-catalog.md");
assertCheck(
  "m17_doc_smoke_ids",
  publicCatalogDoc.includes("SMK-DREG-01") &&
    publicCatalogDoc.includes("SMK-MKT-03") &&
    publicCatalogDoc.includes("SMK-MKT-05") &&
    publicCatalogDoc.includes("SMK-PTL-01") &&
    publicCatalogDoc.includes("denali-portal.css") &&
    publicCatalogDoc.includes("resolveTourOpsApiBaseUrl"),
  "public-catalog.md must document smoke IDs, denali-portal.css, and guest BFF API base"
);

assertCheck(
  "m17_next_workspaces_slug_unambiguous",
  !exists("apps/web/app/api/workspaces/[tenantId]"),
  "remove apps/web/app/api/workspaces/[tenantId] — conflicts with [workspaceId] (Next.js dynamic slug)"
);

const marketingThemeBootstrap = read(
  "apps/marketing/src/bootstrap/workspace-guest-theme-stylesheets.generated.ts"
);
assertCheck(
  "m17_marketing_guest_theme_bootstrap",
  marketingThemeBootstrap.includes("denali-marketing.css") &&
    marketingThemeBootstrap.includes("urban-marketing.css"),
  "generate:workspace-registry must emit denali + urban marketing skins in marketing bootstrap"
);

const denaliExposureResolver = read("apps/api/src/exposure/resolve-denali-surface-exposure.ts");
assertCheck(
  "m17_denali_exposure_db_less_fallback",
  denaliExposureResolver.includes("tryResolvePersistedExposureProfile") &&
    denaliExposureResolver.includes("tryFindExposureIntent"),
  "Denali exposure resolver must catch Prisma failures for DB-less smokes (SMK-MKT-03)"
);

const urbanExposureResolver = read("apps/api/src/exposure/resolve-urban-surface-exposure.ts");
assertCheck(
  "m17_urban_exposure_db_less_fallback",
  urbanExposureResolver.includes("tryResolvePersistedExposureProfile") &&
    urbanExposureResolver.includes("tryFindExposureIntent"),
  "Urban exposure resolver must catch Prisma failures for DB-less smokes (SMK-MKT-05)"
);

const denaliRegistrationFlowSteps = read(
  "packages/workspaces/denali/src/catalog/registration-flow/denali-registration-flow.steps.tsx"
);
assertCheck(
  "m17_portal_member_profile_hook",
  portalRegistrationDoc.includes("data-portal-member-profile") &&
    portalRegistrationDoc.includes("/me/profile"),
  "portal registration doc must document member profile route + hook"
);

assertCheck(
  "m17_portal_registration_transport_hooks",
  portalRegistrationDoc.includes("data-public-registration-transport") &&
    portalRegistrationDoc.includes("data-registration-target-tabs") &&
    denaliRegistrationFlowSteps.includes("data-public-registration-personal-car-opt-in"),
  "portal registration must document transport + registrant tab hooks"
);

const denaliCatalogOpenapi = read("apps/api/src/openapi/denali-catalog-openapi.ts");
assertCheck(
  "m17_denali_catalog_openapi_registration_body",
  denaliCatalogOpenapi.includes("postDenaliRegistration") &&
    denaliCatalogOpenapi.includes("registrantTarget") &&
    denaliCatalogOpenapi.includes("fatherName") &&
    denaliCatalogOpenapi.includes("transport"),
  "denali-catalog-openapi must document registration intake request body"
);

const memberProfileBff = read("apps/portal/app/api/me/profile/route.ts");
assertCheck(
  "m17_member_profile_bff_upstream",
  memberProfileBff.includes("export async function GET") &&
    memberProfileBff.includes("export async function PATCH") &&
    memberProfileBff.includes("/identity/me") &&
    memberProfileBff.includes("buildMemberProfileView"),
  "portal /api/me/profile BFF must proxy identity/me with SDK mapping"
);

assertCheck(
  "m17_session_profile_removed",
  !exists("apps/portal/app/api/public-auth/session-profile/route.ts"),
  "legacy session-profile route must be removed (M4)"
);

const otpFixture = read("apps/portal/tests/e2e/fixtures/catalog-registration-otp.ts");
assertCheck(
  "m17_e2e_fixture_transport_intake",
  otpFixture.includes("data-public-registration-transport") &&
    otpFixture.includes("hasPersonalCar"),
  "E2E fixture must complete transport intake when visible"
);

assertCheck(
  "m17_gitignore_tracks_env_local_example",
  read(".gitignore").includes("!.env.local.example"),
  "root .gitignore must track apps/*/env.local.example dev templates"
);

const guestBffApiBase = read("packages/guest-surface-host/src/resolve-tour-ops-api-base-url.ts");
assertCheck(
  "m17_guest_bff_dev_api_fallback",
  guestBffApiBase.includes("resolveTourOpsApiBaseUrl") &&
    guestBffApiBase.includes("127.0.0.1") &&
    guestBffApiBase.includes("TOUR_OPS_API_URL_NOT_CONFIGURED"),
  "guest-surface-host must expose resolveTourOpsApiBaseUrl with dev :3001 fallback (G-ENV-02)"
);

assertCheck(
  "m17_sdk_catalog_resolver_exports",
  read("packages/workspace-sdk/src/catalog/resolve-catalog-list-features.ts").includes(
    "resolveCatalogListFeatures"
  ) &&
    read("packages/workspace-sdk/src/catalog/resolve-catalog-detail-sections.ts").includes(
      "resolveCatalogDetailSections"
    ) &&
    read("packages/workspace-sdk/src/catalog/resolve-catalog-registration-support.ts").includes(
      "supportsCatalogRegistration"
    ) &&
    read("packages/workspace-sdk/src/catalog/resolve-catalog-registration-api-path.ts").includes(
      "resolveCatalogRegistrationApiPath"
    ) &&
    read("packages/workspace-sdk/src/catalog/build-catalog-registration-upstream-request.ts").includes(
      "buildCatalogRegistrationUpstreamRequest"
    ) &&
    read("packages/workspace-sdk/src/catalog/workspace-intake-plugin-registry.ts").includes(
      "registerWorkspaceIntakePlugin"
    ) &&
    read("packages/workspace-sdk/src/catalog/resolve-intake-schema.ts").includes(
      "getWorkspaceIntakePlugin"
    ),
  "workspace-sdk catalog resolvers must export list/detail/registration dispatch"
);

assertCheck(
  "m17_platform_portal_registration_intake_doc",
  exists("docs/phase-19/platform-portal-registration-intake.mdoc") &&
    read("docs/phase-19/platform-portal-registration-intake.mdoc").includes(
      "buildCatalogRegistrationUpstreamRequest"
    ),
  "platform-portal-registration-intake.mdoc must document SDK dispatch"
);

assertCheck(
  "m17_portal_registration_bff_sdk_dispatch",
  read("apps/portal/app/api/catalog/registrations/route.ts").includes(
    "buildCatalogRegistrationUpstreamRequest"
  ),
  "portal registrations BFF must use SDK upstream builder"
);

const productNeutralAllowlist = read(
  "packages/workspace-sdk/test/product-neutral-core.contract.spec.ts"
);
assertCheck(
  "m17_sdk_product_neutral_registration_allowlist",
  productNeutralAllowlist.includes("build-catalog-registration-upstream-request.ts") &&
    productNeutralAllowlist.includes("resolve-catalog-intake-capabilities.ts") &&
    productNeutralAllowlist.includes("resolve-catalog-registration-api-path.ts"),
  "product-neutral allowlist must include registration dispatch modules"
);

const p6GateScript = read("scripts/p6-denali-product-gate.sh");
assertCheck(
  "m17_p6_gate_registration_intake_specs",
  p6GateScript.includes("test/denali-registration.spec.ts") &&
    p6GateScript.includes("test/catalog-registration-dispatch.spec.ts") &&
    p6GateScript.includes("test/catalog-registration-intake-form-contract.spec.ts") &&
    p6GateScript.includes("test/resolve-denali-registration-transport.spec.ts") &&
    p6GateScript.includes("test/identity-me.spec.ts"),
  "p6:gate must run Denali registration + SDK/portal intake + workspace transport + identity/me specs"
);

const p4GateScript = read("scripts/p4-club-product-gate.sh");
assertCheck(
  "m17_p4_gate_registration_intake_specs",
  p4GateScript.includes("test/denali-registration.spec.ts") &&
    p4GateScript.includes("test/catalog-registration-dispatch.spec.ts") &&
    p4GateScript.includes("test/format-registration-intake.spec.ts") &&
    p4GateScript.includes("test/resolve-denali-registration-transport.spec.ts") &&
    p4GateScript.includes("test/identity-me.spec.ts"),
  "p4:gate must run Denali registration + SDK intake + web ops parser + workspace transport + identity/me specs"
);

const p4ExitSpec = read("apps/api/test/platform-club-product-exit.spec.ts");
assertCheck(
  "m17_p4_exit_spec_registration_intake",
  p4ExitSpec.includes("EX-02c") &&
    p4ExitSpec.includes("denali-registration") &&
    p4ExitSpec.includes("format-registration-intake") &&
    !p4ExitSpec.includes("TEMP/p4-exit-checklist"),
  "platform-club-product-exit.spec must assert p4 registration intake (EX-02c) via docs/ not TEMP"
);

assertCheck(
  "m17_seo_guest_conformance_doc",
  exists("docs/dev/guest-seo-conformance.md") &&
    read("docs/dev/guest-seo-conformance.md").includes("resolveGuestSeoForPlugin"),
  "guest-seo-conformance.md must document SDK resolver"
);

assertCheck(
  "m17_seo_e2e_hooks_manifest",
  exists("docs/dev/guest-seo-e2e-hooks.yaml") &&
    read("docs/dev/guest-seo-e2e-hooks.yaml").includes("SMK-MKT-06") &&
    read("docs/dev/guest-seo-e2e-hooks.yaml").includes("SMK-MKT-08"),
  "guest-seo-e2e-hooks.yaml must list SEO smoke ids"
);

assertCheck(
  "m17_seo_revalidate_dual_tags",
  read("apps/marketing/app/api/revalidate/route.ts").includes("buildMarketingSeoCacheTag") &&
    read("apps/marketing/app/api/revalidate/route.ts").includes("revalidateTag(seoTag)"),
  "marketing revalidate route must purge catalog + seo tags"
);

assertCheck(
  "m17_seo_sdk_resolver_export",
  read("packages/workspace-sdk/src/public-api.ts").includes("resolveGuestSeoForPlugin") &&
    read("packages/workspace-sdk/src/catalog/resolve-guest-seo-for-plugin.ts").includes(
      "WORKSPACE_GUEST_SEO"
    ),
  "workspace-sdk must export resolveGuestSeoForPlugin"
);

assertCheck(
  "m17_seo_marketing_metadata_plugin_resolver",
  read("apps/marketing/src/seo/build-marketing-metadata.ts").includes(
    "resolveGuestSeoForPlugin"
  ) &&
    read("apps/marketing/src/seo/build-marketing-metadata.ts").includes("MARKETING_OG_IMAGE_WIDTH"),
  "build-marketing-metadata must read guest SEO policy and declare OG image dimensions"
);

assertCheck(
  "m17_seo_validate_json_ld_script",
  exists("scripts/validate-json-ld.mjs") &&
    read("scripts/guards/guard-guest-seo.mjs").includes("validate-json-ld.mjs"),
  "validate-json-ld must be wired into guard-guest-seo"
);

assertCheck(
  "m17_seo_semantic_guard",
  exists("scripts/guards/guard-marketing-semantic-seo.mjs") &&
    read("scripts/guards/guard-marketing-semantic-seo.mjs").includes("validateStructuredData"),
  "guard-marketing-semantic-seo must enforce validated JSON-LD render path"
);

assertCheck(
  "m17_seo_lighthouse_config",
  exists("apps/marketing/lighthouserc.json") &&
    read("apps/marketing/lighthouserc.json").includes("categories:seo") &&
    read("apps/marketing/lighthouserc.json").includes("categories:performance"),
  "marketing lighthouserc must assert SEO and Performance categories"
);

assertCheck(
  "m17_seo_prod_guard",
  exists("scripts/guards/guard-marketing-seo-prod.mjs") &&
    read("scripts/guards/guard-marketing-seo-prod.mjs").includes("MARKETING_PUBLIC_BASE_URL"),
  "guard-marketing-seo-prod must enforce HTTPS public origin policy"
);

assertCheck(
  "m17_seo_e2e_hooks_smoke_ten",
  read("docs/dev/guest-seo-e2e-hooks.yaml").includes("SMK-MKT-10") &&
    read("docs/dev/guest-seo-e2e-hooks.yaml").includes("SMK-MKT-11") &&
    read("docs/dev/guest-seo-e2e-hooks.yaml").includes("SMK-MKT-13") &&
    read("docs/dev/guest-seo-e2e-hooks.yaml").includes("SMK-MKT-17") &&
    read("docs/dev/guest-seo-e2e-hooks.yaml").includes("SMK-MKT-104"),
  "guest-seo-e2e-hooks.yaml must list SMK-MKT-10/11/13/17/104"
);

assertCheck(
  "m17_seo_atom_feed_route",
  exists("apps/marketing/app/feed.xml/route.ts") &&
    read("apps/marketing/app/feed.xml/route.ts").includes("buildMarketingAtomFeed"),
  "marketing feed.xml route must emit Atom feed"
);

assertCheck(
  "m17_seo_prod_image_hosts_guard",
  exists("scripts/guards/guard-marketing-prod-image-hosts.mjs") &&
    read("scripts/guards/guard-marketing-prod-image-hosts.mjs").includes(
      "MARKETING_IMAGE_REMOTE_HOSTS"
    ),
  "guard-marketing-prod-image-hosts must enforce image host allowlist policy"
);

assertCheck(
  "m17_marketing_home_hooks_guard",
  exists("scripts/guards/guard-marketing-home-hooks.mjs") &&
    read("scripts/guards/guard-marketing-home-hooks.mjs").includes("SMK-MKT-HOME-01"),
  "guard-marketing-home-hooks must enforce home hook + smoke closure"
);

if (failures.length > 0) {
  console.error(`\nguard-public-catalog-m17 — ${failures.length} FAIL`);
  process.exit(1);
}

const passTotal = checksPassed;
console.log(`\nguard-public-catalog-m17 — ${passTotal}/${passTotal} PASS`);
