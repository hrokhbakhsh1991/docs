#!/usr/bin/env node
/**
 * P7-T01 / PF-3 — scaffold a new workspace package from starter template.
 * Usage: pnpm run workspace:create -- climbing-club [--guest]
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function toPascalCase(id) {
  return id
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

function toCamelCase(id) {
  const pascal = toPascalCase(id);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

function toConstPrefix(id) {
  return id.replace(/-/g, "_").toUpperCase();
}

function deterministicTenantId(id) {
  const hex = createHash("sha256").update(`workspace:create:${id}`).digest("hex");
  const variant = ((Number.parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-${variant}${hex.slice(
    17,
    20
  )}-${hex.slice(20, 32)}`;
}

function writeJson(file, value) {
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function writeBaseManifest(dir, ctx) {
  writeJson(join(dir, "workspace.manifest.json"), {
    id: ctx.id,
    version: 1,
    package: ctx.pkgName,
    workspaceTypes: [ctx.id],
    plugin: { entry: "./plugin", export: ctx.canonicalExportFn },
    web: { entry: "./plugin", export: ctx.canonicalExportFn },
  });
}

function writeGuestManifest(dir, ctx) {
  writeJson(join(dir, "workspace.manifest.json"), buildGuestManifestObject(ctx.id));
}

/** @param {string} id */
export function buildGuestManifestObject(id) {
  const ctx = createContext(id);
  const basePath = `/${ctx.id}`;
  return {
    id: ctx.id,
    version: 1,
    pluginApiVersion: 1,
    guestExtensionsVersion: 1,
    package: ctx.pkgName,
    workspaceTypes: [ctx.id],
    plugin: { entry: "./plugin", export: ctx.canonicalExportFn },
    web: { entry: "./plugin", export: ctx.canonicalExportFn },
    guestConformance: {
      productionTier: "stub",
    },
    http: { prefix: basePath, module: "./http/routes" },
    httpRoutes: {
      handlerPackage: `${ctx.pkgName}/http`,
      loadHandlersFromPackage: true,
      groups: [
        {
          manifestExport: ctx.httpRouteManifestConst,
          staticHandlers: {
            [`GET ${basePath}/catalog`]: ctx.catalogListHandler,
            [`POST ${basePath}/registrations`]: ctx.registrationPostHandler,
          },
          paramHandlers: {
            [`GET ${basePath}/catalog/:tourId`]: ctx.catalogDetailHandler,
          },
        },
      ],
    },
    devBootstrap: {
      pluginTenantIds: [ctx.smokeTenantId],
      smokeTenant: {
        tenantIdExport: ctx.smokeTenantIdConst,
        subdomainExport: ctx.smokeSubdomainConst,
      },
    },
    themeStylesheets: ["theme/tokens.css"],
    guestThemeStylesheets: {
      marketing: ["theme/marketing.css"],
    },
    catalogRegistrationFlow: {
      surfaceExport: ctx.registrationFlowSurfaceExport,
      steps: {
        mode: "compose",
        reuseAuthStepsFrom: "shared",
        components: {
          intake: ctx.intakeStepExport,
          done: ctx.doneStepExport,
        },
      },
    },
    catalogPresentation: {
      listFeatures: { cityFilter: false },
      detailSections: {
        difficulty: false,
        fitness: false,
        itinerary: false,
        policies: false,
      },
    },
    guestLanding: {
      variant: "minimal",
      sections: {
        hero: false,
        latestTours: false,
        latestToursLimit: 0,
        trust: false,
        finalCta: false,
        faq: false,
        footer: false,
        whySection: false,
        journey: false,
        testimonials: false,
        featuredTours: false,
        featuredToursLimit: 0,
        categories: false,
        destinations: false,
        heroSearch: false,
        gallery: false,
        equipment: false,
        blogTeaser: false,
      },
      i18nProfile: "minimal",
    },
    memberProfile: {
      editableFields: ["displayName"],
      readOnlyFields: ["email"],
      sections: [{ id: "identity", fields: ["displayName", "email"] }],
    },
    guestSeo: {
      marketing: {
        homeTitleKey: "seo.homeTitle",
        homeDescriptionKey: "seo.homeDescription",
        listTitleKey: "seo.toursTitle",
        listDescriptionKey: "seo.toursDescription",
        jsonLd: {
          required: true,
          schemaTypes: ["Event"],
          builderExport: `build${ctx.pascal}EventJsonLd`,
          richResultsProfile: "event-stub-v1",
        },
        sitemap: { changefreq: "weekly", priority: 0.8 },
        pagination: { noindexQueryParams: ["cursor"] },
      },
    },
    operatorCapabilities: {
      usersDirectory: false,
      reconciliationTriage: false,
      fieldExposureSurfaces: false,
    },
  };
}

function packageExports(ctx, guest) {
  const pluginExport = {
    types: `./dist/${ctx.id}.plugin.d.ts`,
    default: `./dist/${ctx.id}.plugin.js`,
  };
  const exports = {
    ".": { types: "./dist/index.d.ts", default: "./dist/index.js" },
    "./plugin": pluginExport,
    "./theme/tokens.css": "./theme/tokens.css",
  };
  if (guest) {
    exports["./host/catalog"] = {
      types: "./dist/catalog/index.d.ts",
      default: "./dist/catalog/index.js",
    };
    exports["./host/catalog-registration-flow"] = {
      types: "./dist/catalog/registration-flow/index.d.ts",
      default: "./dist/catalog/registration-flow/index.js",
    };
    exports["./host/catalog-registration-flow/react"] = {
      types: "./dist/catalog/registration-flow/react.d.ts",
      default: "./dist/catalog/registration-flow/react.js",
    };
    exports["./host/http"] = { types: "./dist/http/index.d.ts", default: "./dist/http/index.js" };
    exports["./host/http/routes"] = {
      types: "./dist/http/routes.d.ts",
      default: "./dist/http/routes.js",
    };
    exports["./theme/marketing.css"] = "./theme/marketing.css";
  }
  return exports;
}

function writePackageJson(dir, ctx, guest) {
  const files = guest ? ["dist", "theme/tokens.css", "theme/marketing.css"] : ["dist", "theme/tokens.css"];
  /** @type {Record<string, string>} */
  const dependencies = {
    "@app-tour/design-tokens": "workspace:*",
    "@app-tour/platform-core": "workspace:*",
    "@app-tour/workspace-sdk": "workspace:*",
  };
  if (guest) {
    dependencies["@app-tour/catalog-registration-auth"] = "workspace:*";
  }
  /** @type {Record<string, string>} */
  const devDependencies = {
    "@app-tour/config": "workspace:*",
    "@types/node": "^24.0.0",
    tsx: "^4.20.6",
    typescript: "5.9.3",
  };
  if (guest) {
    devDependencies["@types/react"] = "^19.0.0";
    devDependencies.react = "^19.0.0";
  }
  writeJson(join(dir, "package.json"), {
    name: ctx.pkgName,
    version: "0.1.0",
    private: true,
    description: `${ctx.pascal} workspace plugin — scaffolded by workspace:create`,
    main: "./dist/index.js",
    types: "./dist/index.d.ts",
    exports: packageExports(ctx, guest),
    files,
    scripts: {
      build: guest ? "tsc -p tsconfig.json && tsc -p tsconfig.flow.json" : "tsc -p tsconfig.json",
      lint: "tsc --noEmit",
      test: 'NODE_ENV=test node --import tsx --test "test/**/*.spec.ts"',
    },
    dependencies,
    ...(guest ? { peerDependencies: { react: "^19.0.0", "react-dom": "^19.0.0" } } : {}),
    devDependencies,
  });
}

function writeTsconfig(dir, guest) {
  const excludeTsx = guest
    ? `    "src/catalog/registration-flow/**/*.tsx",
    "src/catalog/registration-flow/react.ts"`
    : `    "src/**/*.tsx"`;
  const jsxOpts = guest
    ? `,
    "jsx": "react-jsx",
    "lib": ["ES2022", "DOM", "DOM.Iterable"]`
    : "";
  writeFileSync(
    join(dir, "tsconfig.json"),
    `{
  "extends": "../../config/tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "noEmit": false${jsxOpts}
  },
  "include": ["src/**/*.ts"],
  "exclude": [
    "src/**/*.spec.ts",
    "test/**/*.spec.ts",
${excludeTsx}
  ]
}
`
  );
  if (!guest) {
    return;
  }
  writeFileSync(
    join(dir, "tsconfig.flow.json"),
    `{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "lib": ["ES2022", "DOM", "DOM.Iterable"]
  },
  "include": [
    "src/catalog/registration-flow/**/*.tsx",
    "src/catalog/registration-flow/react.ts"
  ],
  "exclude": ["src/**/*.spec.ts", "test/**/*.spec.ts"]
}
`
  );
}

function writePlugin(dir, ctx, guest) {
  const intakeImport = guest ? `\nimport { ${ctx.catalogIntakeExport} } from "./catalog";` : "";
  const intakeProperty = guest ? `\n    catalogIntake: ${ctx.catalogIntakeExport},` : "";
  writeFileSync(
    join(dir, "src", `${ctx.id}.plugin.ts`),
    `import {
  createStarterWorkspacePlugin,
  type WorkspacePlugin,
  workspaceThemePresets,
} from "@app-tour/workspace-sdk";${intakeImport}

export const ${ctx.pluginIdConst} = ${JSON.stringify(ctx.id)} as const;
export const ${ctx.typeConst} = ${JSON.stringify(ctx.id)} as const;

export function ${ctx.canonicalExportFn}(): WorkspacePlugin {
  const base = createStarterWorkspacePlugin(workspaceThemePresets["platform-primary"]);
  return Object.freeze({
    ...base,
    id: ${ctx.pluginIdConst},
    supportedWorkspaceTypes: [${ctx.typeConst}],${intakeProperty}
  });
}

/** Branded alias — same singleton factory as {@link ${ctx.canonicalExportFn}}. */
export function ${ctx.exportFn}(): WorkspacePlugin {
  return ${ctx.canonicalExportFn}();
}
`
  );
}

function writeIndex(dir, ctx, guest) {
  const smokeExports = guest
    ? `export { ${ctx.smokeTenantIdConst}, ${ctx.smokeSubdomainConst} } from "./smoke/tenant";\n`
    : "";
  writeFileSync(
    join(dir, "src", "index.ts"),
    `export { ${ctx.canonicalExportFn}, ${ctx.exportFn}, ${ctx.pluginIdConst}, ${ctx.typeConst} } from "./${ctx.id}.plugin";
${smokeExports}`
  );
}

function writeScaffoldSpec(dir, ctx) {
  writeFileSync(
    join(dir, "test", "scaffold.spec.ts"),
    `import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isWorkspacePlugin } from "@app-tour/workspace-sdk";
import {
  ${ctx.canonicalExportFn},
  ${ctx.exportFn},
  ${ctx.pluginIdConst},
} from "../src/${ctx.id}.plugin";

describe("${ctx.id} workspace scaffold", () => {
  it("exports a valid WorkspacePlugin via canonical getWorkspacePlugin", () => {
    const plugin = ${ctx.canonicalExportFn}();
    assert.equal(isWorkspacePlugin(plugin), true);
    assert.equal(plugin.id, ${ctx.pluginIdConst});
    assert.equal(${ctx.exportFn}().id, plugin.id);
  });
});
`
  );
}

function writeDesignLanguage(dir, ctx) {
  mkdirSync(join(dir, "design-language"), { recursive: true });
  writeFileSync(
    join(dir, "design-language", "MASTER.md"),
    `# Design System Master File — ${ctx.pascal}

**Project:** ${ctx.pascal} workspace
**Category:** Guest marketing scaffold (replace before launch)

## Color Palette

| Role | Hex | CSS Variable |
|------|-----|--------------|
| Accent | \`#2563EB\` | \`--ws-color-accent\` / \`--color-primary\` |

**Skin entry:** \`packages/workspaces/${ctx.id}/theme/marketing.css\`

## Rules

- Map brand tokens in \`theme/marketing/tokens.css\` or \`theme/marketing.css\`
- Shell TSX: structure + \`data-*\` only; appearance in workspace CSS
- Update this file when brand is finalized
`
  );
}

function writeTheme(dir, ctx, guest) {
  writeFileSync(
    join(dir, "theme", "tokens.css"),
    `/* ${ctx.pascal} workspace theme — extend --ws-* tokens */
:root {
  --ws-color-accent: #2563eb;
}
`
  );
  if (guest) {
    writeFileSync(
      join(dir, "theme", "marketing.css"),
      `/* ${ctx.pascal} guest marketing theme — replace before launch. */
body[data-app-surface="marketing"][data-workspace-plugin="${ctx.id}"] {
  --color-primary: var(--guest-accent, #2563eb);
  --color-primary-fg: #ffffff;
  --color-bg-page: #f8fafc;
  --color-text-primary: #1a1f26;
  --color-text-muted: #64748b;
  --color-border-default: #e2e8f0;
}

:root {
  --guest-accent: var(--ws-color-accent, #2563eb);
}
`
    );
  }
}

function writeGuestCatalog(dir, ctx) {
  mkdirSync(join(dir, "src", "catalog"), { recursive: true });
  writeFileSync(
    join(dir, "src", "catalog", "catalog-intake.ts"),
    `import {
  CatalogRegistrationPayloadInvalidError,
  type CatalogRegistrationPortalPayload,
  type CatalogRegistrationUpstreamRequest,
  type IntakeSchema,
  type IntakeSchemaContext,
  type WorkspaceCatalogIntakeSurface,
} from "@app-tour/workspace-sdk";

const REGISTRATION_API_PATH = "/${ctx.id}/registrations";

const INTAKE_SCHEMA: IntakeSchema = Object.freeze({
  fields: Object.freeze([
    Object.freeze({ id: "fullName", type: "text", required: true, labelKey: "intake.nameLabel" }),
    Object.freeze({ id: "email", type: "email", required: true, labelKey: "intake.emailLabel" }),
    Object.freeze({ id: "partySize", type: "number", required: true, labelKey: "intake.partySizeLabel" }),
    Object.freeze({ id: "notes", type: "text", required: false, labelKey: "intake.notesLabel" }),
  ]),
  features: Object.freeze({
    registrantTargetTabs: false,
    transportIntake: false,
    notesAtIntake: true,
    idempotencyKey: true,
    successDataAttributes: Object.freeze({ ${JSON.stringify(`data-${ctx.id}-registration-success`)}: true }),
  }),
});

function resolveEffectiveSchema(_context: IntakeSchemaContext): IntakeSchema {
  return INTAKE_SCHEMA;
}

function resolveSubmitValues(input: {
  readonly context: IntakeSchemaContext;
  readonly formValues: Readonly<Record<string, string>>;
}): Readonly<Record<string, string>> {
  const values: Record<string, string> = {};
  for (const field of INTAKE_SCHEMA.fields) {
    values[field.id] = input.formValues[field.id]?.trim() ?? "";
  }
  return Object.freeze(values);
}

function buildUpstreamRequest(
  payload: CatalogRegistrationPortalPayload,
  idempotencyKey: string
): CatalogRegistrationUpstreamRequest {
  if (payload.fullName.trim().length === 0) {
    throw new CatalogRegistrationPayloadInvalidError("FULL_NAME_REQUIRED");
  }
  if (payload.email.trim().length === 0) {
    throw new CatalogRegistrationPayloadInvalidError("EMAIL_REQUIRED");
  }
  return {
    path: REGISTRATION_API_PATH,
    body: {
      tourId: payload.tourId,
      contact: {
        fullName: payload.fullName.trim(),
        email: payload.email.trim(),
        ...(payload.phone.trim().length > 0 ? { phone: payload.phone.trim() } : {}),
      },
      partySize: payload.partySize,
      ...(payload.notes.trim().length > 0 ? { notes: payload.notes.trim() } : {}),
    },
    extraHeaders: Object.freeze({ "Idempotency-Key": idempotencyKey }),
  };
}

export const ${ctx.catalogIntakeExport}: WorkspaceCatalogIntakeSurface = Object.freeze({
  registrationApiPath: REGISTRATION_API_PATH,
  schema: () => INTAKE_SCHEMA,
  resolveEffectiveSchema,
  resolveSubmitValues,
  buildUpstreamRequest: (payload, options) => {
    const key = options?.idempotencyKey?.trim() || "portal-${ctx.id}-registration";
    return buildUpstreamRequest(payload, key);
  },
});
`
  );
  writeFileSync(join(dir, "src", "catalog", "index.ts"), `export { ${ctx.catalogIntakeExport} } from "./catalog-intake";\n`);
}

function writeGuestRegistrationFlow(dir, ctx) {
  const flowDir = join(dir, "src", "catalog", "registration-flow");
  mkdirSync(flowDir, { recursive: true });
  writeFileSync(
    join(flowDir, "registration-flow.surface.ts"),
    `import type {
  FlowEvent,
  FlowRuntimeState,
  IntakeFlowDefinition,
  RegistrationFlowContext,
} from "@app-tour/workspace-sdk";
import { defineCatalogRegistrationFlowSurface } from "@app-tour/workspace-sdk";

const STEPS = ["phone", "otp", "profile", "intake", "done"] as const;

const DEFINITION: IntakeFlowDefinition = Object.freeze({
  initialStep: "phone",
  steps: STEPS,
});

export const ${ctx.registrationFlowSurfaceExport} = defineCatalogRegistrationFlowSurface({
  definition: DEFINITION,
  resolveNextStep: (
    state: FlowRuntimeState,
    event: FlowEvent,
    _context: RegistrationFlowContext
  ): FlowRuntimeState => {
    if (event.type === "merge") {
      return Object.freeze({
        currentStep: state.currentStep,
        data: Object.freeze({ ...state.data, ...event.patch }),
      });
    }
    if (event.type === "transition") {
      return Object.freeze({ currentStep: event.to, data: state.data });
    }
    return state;
  },
  successDataAttributes: () => Object.freeze({ ${JSON.stringify(`data-${ctx.id}-registration-success`)}: true }),
});
`
  );
  writeFileSync(
    join(flowDir, "registration-flow.steps.tsx"),
    `import { readCatalogRegistrationFlowState } from "@app-tour/catalog-registration-auth";
import { mergeFlowState, transitionFlowStep, type RegistrationFlowStepProps } from "@app-tour/workspace-sdk";
import { type FormEvent, type JSX } from "react";

export function ${ctx.intakeStepExport}({ state, dispatch }: RegistrationFlowStepProps): JSX.Element {
  const data = readCatalogRegistrationFlowState(state.data);

  function update(fieldId: string, value: string): void {
    if (fieldId === "fullName") {
      mergeFlowState(state, dispatch, { intakeName: value });
      return;
    }
    if (fieldId === "email") {
      mergeFlowState(state, dispatch, { intakeEmail: value });
      return;
    }
    mergeFlowState(state, dispatch, { [fieldId]: value });
  }

  function submit(event: FormEvent): void {
    event.preventDefault();
    transitionFlowStep(dispatch, "done");
  }

  return (
    <form onSubmit={submit} data-public-registration-intake>
      <label>
        Full name
        <input
          name="fullName"
          data-intake-field="fullName"
          value={data.intakeName}
          onChange={(event) => update("fullName", event.currentTarget.value)}
        />
      </label>
      <label>
        Email
        <input
          name="email"
          type="email"
          data-intake-field="email"
          value={data.intakeEmail}
          onChange={(event) => update("email", event.currentTarget.value)}
        />
      </label>
      <label>
        Party size
        <input
          name="partySize"
          type="number"
          min={1}
          data-intake-field="partySize"
          value={data.partySize}
          onChange={(event) => update("partySize", event.currentTarget.value)}
        />
      </label>
      <button type="submit" data-action="intake-submit">Continue</button>
    </form>
  );
}

export function ${ctx.doneStepExport}({ context }: RegistrationFlowStepProps): JSX.Element {
  return (
    <div data-public-registration-success ${`data-${ctx.id}-registration-success`}={true}>
      <p role="status">Registration received for {context.tourTitle}.</p>
      <p>
        <a href={context.backHref}>Back to tour</a>
      </p>
    </div>
  );
}
`
  );
  writeFileSync(
    join(flowDir, "index.ts"),
    `export { ${ctx.registrationFlowSurfaceExport} } from "./registration-flow.surface";\n`
  );
  writeFileSync(
    join(flowDir, "react.ts"),
    `export { ${ctx.intakeStepExport}, ${ctx.doneStepExport} } from "./registration-flow.steps";\n`
  );
}

function deterministicTourId(id) {
  const hex = createHash("sha256").update(`workspace:create:smoke-tour:${id}`).digest("hex");
  const variant = ((Number.parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-${variant}${hex.slice(
    17,
    20
  )}-${hex.slice(20, 32)}`;
}

function writeGuestHttp(dir, ctx) {
  const httpDir = join(dir, "src", "http");
  const catalogDir = join(dir, "src", "catalog");
  mkdirSync(httpDir, { recursive: true });
  mkdirSync(catalogDir, { recursive: true });

  writeFileSync(
    join(catalogDir, ctx.smokeFixtureFile),
    `import type { PublicCatalogCard } from "@app-tour/workspace-sdk";

/** Opt-in guest smoke catalog card — enable with ${ctx.smokeEnvConst}=1. */
export const ${ctx.smokeTourIdConst} = ${JSON.stringify(ctx.smokeTourId)} as const;
export const ${ctx.smokeTourTitleConst} = ${JSON.stringify(`${ctx.pascal} smoke sail`)} as const;

export function ${ctx.smokeBuildCardFn}(): PublicCatalogCard {
  const card: PublicCatalogCard = Object.freeze({
    id: ${ctx.smokeTourIdConst},
    title: ${ctx.smokeTourTitleConst},
    shortDescription: ${JSON.stringify(`${ctx.id} smoke catalog event`)},
    category: "guest_event",
    departureAt: "2026-10-01T10:00:00.000Z",
    endAt: "2026-10-01T18:00:00.000Z",
    priceAmount: 1_000_000,
    priceCurrency: "IRR",
    coverImageUrl: null,
    totalCapacity: 20,
    catalogUpdatedAt: "2026-07-31T12:00:00.000Z",
  });
  return Object.freeze({
    ...card,
    structuredData: Object.freeze({
      "@context": "https://schema.org",
      "@type": "Event",
      name: card.title,
      eventStatus: "https://schema.org/EventScheduled",
      dateModified: card.catalogUpdatedAt,
    }) as unknown as Readonly<Record<string, unknown>>,
  });
}
`
  );

  // Keep intake export and append smoke fixture exports.
  writeFileSync(
    join(catalogDir, "index.ts"),
    `export { ${ctx.catalogIntakeExport} } from "./catalog-intake";
export {
  ${ctx.smokeBuildCardFn},
  ${ctx.smokeTourIdConst},
  ${ctx.smokeTourTitleConst},
} from "./${ctx.smokeFixtureFile.replace(/\.ts$/, "")}";
`
  );

  writeFileSync(
    join(httpDir, "routes-manifest.ts"),
    `import type { WorkspaceHttpMethod } from "@app-tour/workspace-sdk";

export const ${ctx.httpRouteManifestConst}: readonly {
  readonly method: WorkspaceHttpMethod;
  readonly path: string;
}[] = [
  { method: "GET", path: "/${ctx.id}/catalog" },
  { method: "GET", path: "/${ctx.id}/catalog/:tourId" },
  { method: "POST", path: "/${ctx.id}/registrations" },
] as const;
`
  );

  writeFileSync(
    join(httpDir, ctx.catalogHttpFile),
    `import type { IncomingMessage, ServerResponse } from "node:http";

import { createWorkspaceGuestSmokeHttpHandlers } from "@app-tour/workspace-sdk";

import {
  ${ctx.smokeBuildCardFn},
  ${ctx.smokeTourIdConst},
} from "../catalog/${ctx.smokeFixtureFile.replace(/\.ts$/, "")}";

function isSmokeSeedEnabled(): boolean {
  return process.env.${ctx.smokeEnvConst} === "1";
}

const handlers = createWorkspaceGuestSmokeHttpHandlers({
  isSeedEnabled: isSmokeSeedEnabled,
  publishedTourId: ${ctx.smokeTourIdConst},
  buildCard: ${ctx.smokeBuildCardFn},
});

export async function ${ctx.registrationPostHandler}(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  return handlers.handleRegister(req, res);
}

export async function ${ctx.catalogListHandler}(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  return handlers.handleList(req, res);
}

export async function ${ctx.catalogDetailHandler}(
  req: IncomingMessage,
  res: ServerResponse,
  tourId: string
): Promise<void> {
  return handlers.handleDetail(req, res, tourId);
}
`
  );

  writeFileSync(
    join(httpDir, "routes.ts"),
    `import { ${ctx.httpRouteManifestConst} } from "./routes-manifest";

export {
  ${ctx.catalogListHandler},
  ${ctx.catalogDetailHandler},
  ${ctx.registrationPostHandler},
} from "./${ctx.catalogHttpFile.replace(/\.ts$/, "")}";
export { ${ctx.httpRouteManifestConst} };
`
  );

  writeFileSync(
    join(httpDir, "index.ts"),
    `export {
  ${ctx.httpRouteManifestConst},
  ${ctx.catalogListHandler},
  ${ctx.catalogDetailHandler},
  ${ctx.registrationPostHandler},
} from "./routes";
`
  );
}

function writeGuestSmoke(dir, ctx) {
  const smokeDir = join(dir, "src", "smoke");
  mkdirSync(smokeDir, { recursive: true });
  writeFileSync(
    join(smokeDir, "tenant.ts"),
    `export const ${ctx.smokeSubdomainConst} = ${JSON.stringify(ctx.id)} as const;
export const ${ctx.smokeTenantIdConst} = ${JSON.stringify(ctx.smokeTenantId)} as const;
`
  );
}

function writeGuestPackageTests(dir, ctx) {
  const catalogHttpModule = ctx.catalogHttpFile.replace(/\.ts$/, "");
  const fixtureModule = ctx.smokeFixtureFile.replace(/\.ts$/, "");

  writeFileSync(
    join(dir, "test", "guest-smoke-http.spec.ts"),
    `import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import type { IncomingMessage, ServerResponse } from "node:http";
import { describe, it } from "node:test";

import {
  ${ctx.catalogListHandler},
  ${ctx.catalogDetailHandler},
  ${ctx.registrationPostHandler},
} from "../src/http/${catalogHttpModule}";
import {
  ${ctx.smokeBuildCardFn},
  ${ctx.smokeTourIdConst},
  ${ctx.smokeTourTitleConst},
} from "../src/catalog/${fixtureModule}";

function mockRes(): ServerResponse & {
  readonly body: string;
  readonly status: number;
} {
  let body = "";
  let status = 0;
  const res = {
    get body() {
      return body;
    },
    get status() {
      return status;
    },
    set statusCode(value: number) {
      status = value;
    },
    get statusCode() {
      return status;
    },
    setHeader() {},
    end(chunk?: string) {
      body = chunk ?? "";
    },
  };
  return res as unknown as ServerResponse & { readonly body: string; readonly status: number };
}

function mockJsonReq(payload: unknown): IncomingMessage {
  const req = new EventEmitter() as IncomingMessage & EventEmitter;
  queueMicrotask(() => {
    req.emit("data", Buffer.from(JSON.stringify(payload), "utf8"));
    req.emit("end");
  });
  return req;
}

describe("${ctx.id} guest smoke catalog fixture", () => {
  it("builds an Event card with stable id", () => {
    const card = ${ctx.smokeBuildCardFn}();
    assert.equal(card.id, ${ctx.smokeTourIdConst});
    assert.equal(card.title, ${ctx.smokeTourTitleConst});
    assert.equal(
      (card.structuredData as { readonly "@type"?: string } | undefined)?.["@type"],
      "Event",
    );
  });
});

describe("${ctx.id} guest catalog HTTP", () => {
  it("defaults to guest stub when smoke seed disabled", async () => {
    delete process.env.${ctx.smokeEnvConst};
    const res = mockRes();
    await ${ctx.catalogListHandler}({ url: "/${ctx.id}/catalog" } as IncomingMessage, res);
    assert.equal(res.status, 501);
    assert.match(res.body, /WORKSPACE_GUEST_STUB/);
  });

  it("lists smoke card when seed enabled", async () => {
    process.env.${ctx.smokeEnvConst} = "1";
    const res = mockRes();
    await ${ctx.catalogListHandler}({ url: "/${ctx.id}/catalog" } as IncomingMessage, res);
    assert.equal(res.status, 200);
    const parsed = JSON.parse(res.body) as {
      success: boolean;
      data: { items: Array<{ id: string }> };
      metadata: { nextCursor: null };
    };
    assert.equal(parsed.success, true);
    assert.equal(parsed.data.items[0]?.id, ${ctx.smokeTourIdConst});
    assert.equal(parsed.metadata.nextCursor, null);
    delete process.env.${ctx.smokeEnvConst};
  });

  it("returns detail and accepts registration under seed", async () => {
    process.env.${ctx.smokeEnvConst} = "1";
    const detail = mockRes();
    await ${ctx.catalogDetailHandler}({} as IncomingMessage, detail, ${ctx.smokeTourIdConst});
    assert.equal(detail.status, 200);

    const created = mockRes();
    await ${ctx.registrationPostHandler}(
      mockJsonReq({
        tourId: ${ctx.smokeTourIdConst},
        contact: { fullName: "Ada Guest", email: "ada@example.com" },
        partySize: 2,
      }),
      created,
    );
    assert.equal(created.status, 201);
    const parsed = JSON.parse(created.body) as {
      success: boolean;
      data: { tourId: string; status: string };
    };
    assert.equal(parsed.success, true);
    assert.equal(parsed.data.tourId, ${ctx.smokeTourIdConst});
    assert.equal(parsed.data.status, "pending");
    delete process.env.${ctx.smokeEnvConst};
  });
});
`
  );

  writeFileSync(
    join(dir, "test", "guest-clone-budget.spec.ts"),
    `import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function listTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...listTsFiles(full));
    } else if (name.endsWith(".ts") && !name.endsWith(".d.ts")) {
      out.push(full);
    }
  }
  return out;
}

describe("${ctx.id} guest clone detector lite", () => {
  it("keeps HTTP surface tiny vs Denali-scale forests", () => {
    const httpFiles = listTsFiles(join(root, "src/http"));
    assert.ok(
      httpFiles.length <= 6,
      \`expected ≤6 ${ctx.id} http modules, got \${httpFiles.length}\`,
    );
  });

  it("does not import workspace-denali from ${ctx.id} src", () => {
    for (const file of listTsFiles(join(root, "src"))) {
      const text = readFileSync(file, "utf8");
      assert.doesNotMatch(
        text,
        /@app-tour\\/workspace-denali/,
        \`denali import in \${file}\`,
      );
    }
  });
});
`
  );
}

function createContext(id) {
  const pascal = toPascalCase(id);
  const camel = toCamelCase(id);
  const constPrefix = toConstPrefix(id);
  return {
    id,
    pascal,
    camel,
    pkgName: `@app-tour/workspace-${id}`,
    /** Canonical host-contract getter (manifest plugin/web.export; Phase 4n). */
    canonicalExportFn: "getWorkspacePlugin",
    /** Branded alias for local tests / package ergonomics. */
    exportFn: `get${pascal}WorkspacePlugin`,
    pluginIdConst: `${constPrefix}_WORKSPACE_PLUGIN_ID`,
    typeConst: `${constPrefix}_WORKSPACE_TYPE`,
    catalogIntakeExport: `${camel}CatalogIntakeSurface`,
    registrationFlowSurfaceExport: `${camel}CatalogRegistrationFlowSurface`,
    intakeStepExport: `${pascal}IntakeStep`,
    doneStepExport: `${pascal}DoneStep`,
    httpRouteManifestConst: `${constPrefix}_HTTP_ROUTE_MANIFEST`,
    catalogListHandler: `handleGet${pascal}Catalog`,
    catalogDetailHandler: `handleGet${pascal}CatalogTour`,
    registrationPostHandler: `handlePost${pascal}Registration`,
    smokeTenantId: deterministicTenantId(id),
    smokeTenantIdConst: `${constPrefix}_SMOKE_TENANT_ID`,
    smokeSubdomainConst: `${constPrefix}_SMOKE_SUBDOMAIN`,
    smokeTourId: deterministicTourId(id),
    smokeTourIdConst: `${constPrefix}_SMOKE_TOUR_ID`,
    smokeTourTitleConst: `${constPrefix}_SMOKE_TOUR_TITLE`,
    smokeBuildCardFn: `build${pascal}SmokeCatalogCard`,
    smokeEnvConst: `${constPrefix}_SMOKE_E2E_SEED`,
    smokeFixtureFile: `${id}-smoke-catalog.fixture.ts`,
    catalogHttpFile: `${id}-catalog-http.ts`,
  };
}

export function scaffoldWorkspace({ repoRoot = REPO_ROOT, id, guest = false }) {
  if (!id || !/^[a-z][a-z0-9-]*$/.test(id)) {
    throw new Error(`Invalid workspace id "${id ?? ""}" — use kebab-case [a-z0-9-]`);
  }
  const ctx = createContext(id);
  const dir = join(repoRoot, "packages/workspaces", id);
  if (existsSync(dir)) {
    throw new Error(`Already exists: ${dir}`);
  }

  mkdirSync(join(dir, "src"), { recursive: true });
  mkdirSync(join(dir, "test"), { recursive: true });
  mkdirSync(join(dir, "theme"), { recursive: true });

  if (guest) writeGuestManifest(dir, ctx);
  else writeBaseManifest(dir, ctx);
  writePackageJson(dir, ctx, guest);
  writeTsconfig(dir, guest);
  writePlugin(dir, ctx, guest);
  writeIndex(dir, ctx, guest);
  writeScaffoldSpec(dir, ctx);
  writeTheme(dir, ctx, guest);
  if (guest) {
    writeDesignLanguage(dir, ctx);
  }
  if (guest) {
    writeGuestCatalog(dir, ctx);
    writeGuestRegistrationFlow(dir, ctx);
    writeGuestHttp(dir, ctx);
    writeGuestSmoke(dir, ctx);
    writeGuestPackageTests(dir, ctx);
  }
  return { dir, pkgName: ctx.pkgName, guest };
}

/**
 * CW0-09 — repo-relative paths a guest L3 scaffold would create (no disk writes).
 * @param {string} id
 * @returns {string[]}
 */
export function planGuestWorkspaceScaffoldPaths(id) {
  if (!id || !/^[a-z][a-z0-9-]*$/.test(id)) {
    throw new Error(`Invalid workspace id "${id ?? ""}" — use kebab-case [a-z0-9-]`);
  }
  const ctx = createContext(id);
  const base = `packages/workspaces/${id}`;
  const fixtureStem = ctx.smokeFixtureFile.replace(/\.ts$/, "");
  const catalogHttpStem = ctx.catalogHttpFile.replace(/\.ts$/, "");
  return [
    `${base}/design-language/MASTER.md`,
    `${base}/package.json`,
    `${base}/src/catalog/catalog-intake.ts`,
    `${base}/src/catalog/index.ts`,
    `${base}/src/catalog/${ctx.smokeFixtureFile}`,
    `${base}/src/catalog/registration-flow/index.ts`,
    `${base}/src/catalog/registration-flow/react.ts`,
    `${base}/src/catalog/registration-flow/registration-flow.steps.tsx`,
    `${base}/src/catalog/registration-flow/registration-flow.surface.ts`,
    `${base}/src/http/index.ts`,
    `${base}/src/http/${ctx.catalogHttpFile}`,
    `${base}/src/http/routes-manifest.ts`,
    `${base}/src/http/routes.ts`,
    `${base}/src/index.ts`,
    `${base}/src/${ctx.id}.plugin.ts`,
    `${base}/src/smoke/tenant.ts`,
    `${base}/test/guest-clone-budget.spec.ts`,
    `${base}/test/guest-smoke-http.spec.ts`,
    `${base}/test/scaffold.spec.ts`,
    `${base}/theme/marketing.css`,
    `${base}/theme/tokens.css`,
    `${base}/tsconfig.flow.json`,
    `${base}/tsconfig.json`,
    `${base}/workspace.manifest.json`,
  ].sort();
}

function usage() {
  console.error("Usage: pnpm run workspace:create -- <workspace-id> [--guest]");
  console.error("Example: pnpm run workspace:create -- climbing-club --guest");
  process.exit(1);
}

function main(argv) {
  const args = argv.slice(2).filter((arg) => arg !== "--");
  const id = args[0]?.trim();
  if (!id || id.startsWith("-")) usage();
  const flags = new Set(args.slice(1));
  const unknown = [...flags].filter((flag) => flag !== "--guest");
  if (unknown.length > 0) {
    console.error(`Unknown option: ${unknown.join(", ")}`);
    usage();
  }
  try {
    const result = scaffoldWorkspace({ id, guest: flags.has("--guest") });
    console.log(`workspace:create — scaffolded ${result.pkgName}${result.guest ? " (guest L3)" : ""}`);
    console.log(`  ${result.dir}`);
    console.log("Next:");
    console.log("  pnpm install");
    console.log("  pnpm run generate:workspace-registry");
    console.log(`  pnpm --filter ${result.pkgName} run build && pnpm --filter ${result.pkgName} run test`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv);
}
