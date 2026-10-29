import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { isIP } from "node:net";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, devices, type PlaywrightTestConfig } from "@playwright/test";
import { validateTenantSurfaceOriginMap } from "@app-tour/guest-surface-host";

export type StagingSurface = "marketing" | "admin" | "portal";
export type StagingTenantLabel = "A" | "B";

export type TwoTenantStagingManifest = {
  readonly version: 1;
  readonly runtimeSha: string;
  readonly expectedIngressAddresses: readonly string[];
  readonly tenants: Readonly<
    Record<
      StagingTenantLabel,
      {
        readonly tenantId: string;
        readonly hosts: Readonly<Record<StagingSurface, string>>;
        readonly cookieDomain: string | null;
      }
    >
  >;
};

const SURFACES: readonly StagingSurface[] = ["marketing", "admin", "portal"];
const HOST_ENV: Readonly<Record<StagingTenantLabel, Readonly<Record<StagingSurface, string>>>> = {
  A: {
    marketing: "DENALI_STAGING_A_MARKETING_URL",
    admin: "DENALI_STAGING_A_ADMIN_URL",
    portal: "DENALI_STAGING_A_PORTAL_URL",
  },
  B: {
    marketing: "DENALI_STAGING_B_MARKETING_URL",
    admin: "DENALI_STAGING_B_ADMIN_URL",
    portal: "DENALI_STAGING_B_PORTAL_URL",
  },
};

function assertAllowedStagingHostname(hostname: string): void {
  const normalized = hostname.toLowerCase();
  const isPrivateTestHost = normalized.endsWith(".staging.test");
  const isStagingShenskiHost = /^staging-(?:admin-|portal-)?[a-z0-9-]+\.shenski\.com$/.test(
    normalized
  );
  if (!isPrivateTestHost && !isStagingShenskiHost) {
    throw new Error(`refusing host outside the staging hostname allowlist: ${hostname}`);
  }
}

function parseOrigin(value: unknown, field: string): string {
  if (typeof value !== "string") throw new Error(`${field} must be a URL string`);
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${field} must be an absolute HTTPS URL`);
  }
  if (
    parsed.protocol !== "https:" ||
    parsed.username.length > 0 ||
    parsed.password.length > 0 ||
    parsed.pathname !== "/" ||
    parsed.search.length > 0 ||
    parsed.hash.length > 0 ||
    (parsed.port.length > 0 && parsed.port !== "443")
  ) {
    throw new Error(`${field} must be a portless HTTPS origin without credentials or path`);
  }
  assertAllowedStagingHostname(parsed.hostname);
  return parsed.origin;
}

export function validateTwoTenantStagingManifest(raw: unknown): TwoTenantStagingManifest {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("two-tenant staging manifest must be an object");
  }
  const value = raw as Record<string, unknown>;
  if (
    value.version !== 1 ||
    typeof value.runtimeSha !== "string" ||
    !/^[a-f0-9]{40}$/i.test(value.runtimeSha)
  ) {
    throw new Error("manifest version/runtimeSha is invalid");
  }
  if (
    !Array.isArray(value.expectedIngressAddresses) ||
    value.expectedIngressAddresses.length === 0 ||
    value.expectedIngressAddresses.some(
      (address) => typeof address !== "string" || isIP(address) === 0
    )
  ) {
    throw new Error("manifest expectedIngressAddresses must contain one or more IP addresses");
  }
  if (value.tenants === null || typeof value.tenants !== "object" || Array.isArray(value.tenants)) {
    throw new Error("manifest tenants must contain A and B");
  }
  const tenants = value.tenants as Record<string, unknown>;
  const ids = new Set<string>();
  const urls = new Set<string>();
  const validated = {} as Record<
    StagingTenantLabel,
    { tenantId: string; hosts: Record<StagingSurface, string>; cookieDomain: string | null }
  >;

  for (const label of ["A", "B"] as const) {
    const tenant = tenants[label];
    if (tenant === null || typeof tenant !== "object" || Array.isArray(tenant)) {
      throw new Error(`tenant ${label} is missing`);
    }
    const entry = tenant as Record<string, unknown>;
    if (
      typeof entry.tenantId !== "string" ||
      !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(
        entry.tenantId.trim()
      )
    ) {
      throw new Error(`tenant ${label} requires a UUID tenantId`);
    }
    const tenantId = entry.tenantId.trim().toLowerCase();
    if (ids.has(tenantId)) throw new Error("tenant A and B must have different tenant IDs");
    ids.add(tenantId);
    if (entry.hosts === null || typeof entry.hosts !== "object" || Array.isArray(entry.hosts)) {
      throw new Error(`tenant ${label} requires a surface host map`);
    }
    const rawHosts = entry.hosts as Record<string, unknown>;
    const hosts = {} as Record<StagingSurface, string>;
    for (const surface of SURFACES) {
      const origin = parseOrigin(rawHosts[surface], `tenant ${label} ${surface}`);
      if (urls.has(origin)) throw new Error(`duplicate origin in staging manifest: ${origin}`);
      urls.add(origin);
      hosts[surface] = origin;
    }
    const cookieDomain = entry.cookieDomain;
    if (cookieDomain !== null && typeof cookieDomain !== "string") {
      throw new Error(`tenant ${label} cookieDomain must be a hostname or null`);
    }
    validated[label] = { tenantId, hosts, cookieDomain };
  }
  validateTenantSurfaceOriginMap({
    version: 1,
    tenants: Object.values(validated).map(({ tenantId, hosts, cookieDomain }) => ({
      tenantId,
      origins: hosts,
      cookieDomain,
    })),
  });
  return {
    version: 1,
    runtimeSha: value.runtimeSha,
    expectedIngressAddresses: [...new Set(value.expectedIngressAddresses as string[])],
    tenants: validated,
  };
}

export function loadTwoTenantStagingManifest(
  path = process.env.DENALI_TWO_TENANT_STAGING_MANIFEST
): TwoTenantStagingManifest {
  if (path === undefined || path.trim().length === 0) {
    throw new Error(
      "DENALI_TWO_TENANT_STAGING_MANIFEST must point to the approved runtime manifest"
    );
  }
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(path, "utf8"));
  } catch {
    throw new Error("unable to read the two-tenant staging manifest");
  }
  return validateTwoTenantStagingManifest(raw);
}

function applyManifestEnvironment(manifest: TwoTenantStagingManifest): void {
  process.env.PW_EXTERNAL_SERVERS = "1";
  process.env.TENANT_SURFACE_ORIGIN_MAP_JSON = JSON.stringify({
    version: 1,
    tenants: Object.values(manifest.tenants).map(({ tenantId, hosts, cookieDomain }) => ({
      tenantId,
      origins: hosts,
      cookieDomain,
    })),
  });
  for (const label of ["A", "B"] as const) {
    for (const surface of SURFACES) {
      process.env[HOST_ENV[label][surface]] = manifest.tenants[label].hosts[surface];
    }
  }
}

type StagingRunArtifacts = {
  readonly runId: string;
  readonly testSha: string;
  readonly outputDir: string;
};

export function assertStagingTestShaMatchesCheckout(testSha: string, checkoutSha: string): void {
  if (!/^[a-f0-9]{40}$/i.test(checkoutSha) || testSha.toLowerCase() !== checkoutSha.toLowerCase()) {
    throw new Error("DENALI_TWO_TENANT_TEST_SHA must match the current Git checkout HEAD");
  }
}

export function assertStagingRunnerCheckoutClean(status: string): void {
  if (status.length > 0) {
    throw new Error("two-tenant staging runner requires a clean Git checkout");
  }
}

const STAGING_RUN_NONCE_ENV = "DENALI_TWO_TENANT_RUN_NONCE";
const STAGING_RUN_OWNER_FILE = ".runner-owner";

export function reserveStagingRunOutputDirectory(
  runId: string,
  outputDir: string,
  environment: NodeJS.ProcessEnv = process.env
): void {
  const outputParent = dirname(outputDir);
  const lockDir = join(outputParent, `.${runId}.runner-lock`);
  const ownerFile = join(lockDir, STAGING_RUN_OWNER_FILE);
  const inheritedNonce = environment[STAGING_RUN_NONCE_ENV];

  if (inheritedNonce) {
    let existingNonce: string;
    try {
      existingNonce = readFileSync(ownerFile, "utf8");
    } catch {
      throw new Error(`staging artifact directory is not owned by this Playwright run ${runId}`);
    }
    if (existingNonce !== inheritedNonce) {
      throw new Error(`staging artifact directory is not owned by this Playwright run ${runId}`);
    }
    mkdirSync(outputDir, { recursive: true, mode: 0o700 });
    return;
  }

  mkdirSync(outputParent, { recursive: true });
  if (existsSync(outputDir)) {
    throw new Error(`staging artifact directory already exists for run ${runId}`);
  }
  try {
    mkdirSync(lockDir, { mode: 0o700 });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") {
      throw new Error(`staging artifact directory already exists for run ${runId}`);
    }
    throw error;
  }

  const nonce = randomBytes(32).toString("hex");
  writeFileSync(ownerFile, nonce, { flag: "wx", mode: 0o600 });
  mkdirSync(outputDir, { mode: 0o700 });
  environment[STAGING_RUN_NONCE_ENV] = nonce;
}

export function assertStagingRunnerCheckout(testSha: string): void {
  const webRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
  let checkoutSha: string;
  let checkoutStatus: string;
  try {
    checkoutSha = execFileSync("git", ["rev-parse", "--verify", "HEAD"], {
      cwd: resolve(webRoot, "../.."),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    checkoutStatus = execFileSync("git", ["status", "--porcelain", "--untracked-files=all"], {
      cwd: resolve(webRoot, "../.."),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    throw new Error("unable to verify the current Git checkout for staging evidence");
  }
  assertStagingRunnerCheckoutClean(checkoutStatus);
  assertStagingTestShaMatchesCheckout(testSha, checkoutSha);
}

function resolveStagingRunArtifacts(): StagingRunArtifacts {
  const runId = process.env.DENALI_TWO_TENANT_RUN_ID?.trim() ?? "";
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/.test(runId)) {
    throw new Error("DENALI_TWO_TENANT_RUN_ID must be a unique, filesystem-safe run identifier");
  }
  const testSha = process.env.DENALI_TWO_TENANT_TEST_SHA?.trim() ?? "";
  if (!/^[a-f0-9]{40}$/i.test(testSha)) {
    throw new Error(
      "DENALI_TWO_TENANT_TEST_SHA must contain the exact 40-character test commit SHA"
    );
  }
  const webRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
  const outputDir = resolve(webRoot, "test-results", "two-tenant-staging", runId);
  reserveStagingRunOutputDirectory(runId, outputDir);
  return { runId, testSha: testSha.toLowerCase(), outputDir };
}

type ConfigOverrides = Omit<PlaywrightTestConfig, "globalSetup" | "webServer" | "use"> & {
  readonly use?: PlaywrightTestConfig["use"];
};

export function defineTwoTenantStagingConfig(overrides: ConfigOverrides): PlaywrightTestConfig {
  const manifest = loadTwoTenantStagingManifest();
  const runArtifacts = resolveStagingRunArtifacts();
  applyManifestEnvironment(manifest);
  const overrideUse = overrides.use ?? {};
  const launchArgs = Array.isArray(overrideUse.launchOptions?.args)
    ? overrideUse.launchOptions.args.filter(
        (argument) =>
          argument !== "--disable-web-security" &&
          !argument.startsWith("--host-resolver-rules=") &&
          !argument.startsWith("--ignore-certificate-errors") &&
          argument !== "--allow-insecure-localhost"
      )
    : [];
  return defineConfig({
    ...overrides,
    globalSetup: undefined,
    webServer: undefined,
    outputDir: runArtifacts.outputDir,
    reporter: [
      ["list"],
      [
        fileURLToPath(new URL("./two-tenant-staging-result-reporter.mjs", import.meta.url)),
        {
          runtimeSha: manifest.runtimeSha,
          testSha: runArtifacts.testSha,
          tenantLabels: ["A", "B"],
          runId: runArtifacts.runId,
          outputDir: runArtifacts.outputDir,
        },
      ],
    ],
    use: {
      ...devices["Desktop Chrome"],
      ...overrideUse,
      baseURL: manifest.tenants.A.hosts.admin,
      ignoreHTTPSErrors: false,
      screenshot: "only-on-failure",
      trace: "retain-on-failure",
      launchOptions: { ...overrideUse.launchOptions, args: launchArgs },
    },
  });
}
