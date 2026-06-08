/**
 * Phase 8.5 — Product Parity contract (REQ-P8 closure)
 * Authority: docs/phase-8/subphases/8.5-platform-dod.md · phase-8-charter § Definition of Done
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execSync, spawnSync } from "node:child_process";
import http from "node:http";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { before, describe, it } from "node:test";

import { isWorkspacePlugin } from "@app-tour/workspace-sdk";
import { getUrbanWorkspacePlugin, URBAN_THEME_TOKENS_STYLESHEET } from "@app-tour/workspace-urban";

import { createRequestListener } from "../src/app";
import { InMemoryTourRepository } from "../src/storage/in-memory-tour.repository";
import { encodeDevBearerToken } from "../src/tenant-kernel/parse-bearer";
import { URBAN_SMOKE_E2E } from "./fixtures/urban-smoke-e2e-tenant";
import { createTestToursService, installMemoryStorageDriverForDescribe } from "./test-helpers";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "../../..");
const BASELINE_YAML = join(REPO_ROOT, "reports/phase-8-genericity-baseline.yaml");
const PLATFORM_CORE = join(REPO_ROOT, "packages/platform-core");
const URBAN_PACKAGE = join(REPO_ROOT, "packages/workspaces/urban");

const PHASE_8_GENERICITY_PROOF_REV = 1;
const PLATFORM_CORE_SKIP_DIRS = new Set(["node_modules", "dist", "coverage"]);

function isEphemeralPlatformCorePath(relPath: string): boolean {
  const top = relPath.split("/")[0];
  return top != null && PLATFORM_CORE_SKIP_DIRS.has(top);
}

function normalizePlatformCoreFingerprint(files: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(files).filter(([relPath]) => !isEphemeralPlatformCorePath(relPath))
  );
}

function digestPlatformCoreTree(files: Record<string, string>): string {
  const normalized = normalizePlatformCoreFingerprint(files);
  const lines = Object.keys(normalized)
    .sort()
    .map((relPath) => `${relPath}\t${normalized[relPath]}`);
  return createHash("sha256").update(lines.join("\n")).digest("hex");
}

function readBaselineYaml(): string {
  return readFileSync(BASELINE_YAML, "utf8");
}

function readBaselineSha(): string {
  const match = /baseline_sha:\s*["']?([0-9a-f]{7,40})["']?/i.exec(readBaselineYaml());
  if (!match?.[1]) {
    throw new Error("phase-8-genericity-baseline.yaml missing baseline_sha");
  }
  return match[1];
}

function readBaselineTreeDigest(): string {
  const match = /platform_core_tree_digest:\s*([0-9a-f]{64})/i.exec(readBaselineYaml());
  if (!match?.[1]) {
    throw new Error("phase-8-genericity-baseline.yaml missing platform_core_tree_digest");
  }
  return match[1];
}

function baselineRefExists(baselineSha: string): boolean {
  const result = spawnSync("git", ["rev-parse", "--verify", `${baselineSha}^{commit}`], {
    cwd: REPO_ROOT,
    encoding: "utf8",
  });
  return result.status === 0;
}

function gitDiffPlatformCore(baselineSha: string): string {
  return execSync(`git diff ${baselineSha} -- packages/platform-core`, {
    cwd: REPO_ROOT,
    encoding: "utf8",
  }).trim();
}

function hashFile(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function fingerprintPlatformCore(): Record<string, string> {
  const files: Record<string, string> = {};
  const walk = (dir: string): void => {
    for (const ent of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, ent.name);
      if (ent.isDirectory()) {
        if (PLATFORM_CORE_SKIP_DIRS.has(ent.name)) continue;
        walk(path);
        continue;
      }
      if (ent.name.endsWith(".md")) continue;
      const rel = relative(PLATFORM_CORE, path).replace(/\\/g, "/");
      files[rel] = hashFile(path);
    }
  };
  walk(PLATFORM_CORE);
  return files;
}

function assertPlatformCoreMatchesTreeDigest(): void {
  const expectedDigest = readBaselineTreeDigest();
  const currentDigest = digestPlatformCoreTree(fingerprintPlatformCore());
  assert.equal(
    currentDigest,
    expectedDigest,
    `platform-core tree digest drift since phase-8 baseline (proof rev ${PHASE_8_GENERICITY_PROOF_REV})`
  );
}

function assertPlatformCoreUnchangedSinceBaseline(baselineSha: string): void {
  if (baselineRefExists(baselineSha)) {
    const diff = gitDiffPlatformCore(baselineSha);
    assert.equal(
      diff,
      "",
      `platform-core changed since baseline ${baselineSha} — urban product must not touch core:\n${diff}`
    );
    return;
  }
  assertPlatformCoreMatchesTreeDigest();
}

function listPlatformCoreSourceFiles(dir = PLATFORM_CORE, out: string[] = []): string[] {
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, ent.name);
    if (ent.isDirectory()) {
      if (PLATFORM_CORE_SKIP_DIRS.has(ent.name)) continue;
      listPlatformCoreSourceFiles(path, out);
    } else if (!ent.name.endsWith(".md")) {
      out.push(path);
    }
  }
  return out;
}

function searchPlatformCore(pattern: RegExp): string[] {
  const hits: string[] = [];
  for (const file of listPlatformCoreSourceFiles()) {
    const lines = readFileSync(file, "utf8").split("\n");
    for (let i = 0; i < lines.length; i++) {
      if (pattern.test(lines[i]!)) {
        const rel = relative(REPO_ROOT, file).replace(/\\/g, "/");
        hits.push(`${rel}:${i + 1}:${lines[i]}`);
      }
    }
  }
  return hits;
}

function createUrbanSmokeListener(): ReturnType<typeof createRequestListener> {
  const tourStore = new InMemoryTourRepository();
  tourStore.ensureUrbanPhase81PublishedTour();
  return createRequestListener({
    toursService: createTestToursService(tourStore),
    tourStore,
  });
}

function memberBearer(): string {
  return encodeDevBearerToken({
    userId: URBAN_SMOKE_E2E.memberUserId,
    tenantId: URBAN_SMOKE_E2E.tenantId,
    role: "member",
    status: "ACTIVE",
    workspaceId: URBAN_SMOKE_E2E.workspaceId,
  });
}

async function requestUrban(
  listener: ReturnType<typeof createRequestListener>,
  method: "PATCH",
  path: string,
  options?: { headers?: Record<string, string>; body?: unknown }
): Promise<{ status: number; body: unknown }> {
  return new Promise((resolve, reject) => {
    const server = http.createServer(listener);
    server.listen(0, () => {
      const addr = server.address();
      if (!addr || typeof addr === "string") {
        server.close();
        reject(new Error("no listen address"));
        return;
      }
      const payload = options?.body === undefined ? undefined : JSON.stringify(options.body);
      const req = http.request(
        {
          hostname: "127.0.0.1",
          port: addr.port,
          path,
          method,
          headers: {
            ...options?.headers,
            ...(payload
              ? {
                  "Content-Type": "application/json",
                  "Content-Length": String(Buffer.byteLength(payload)),
                }
              : {}),
          },
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on("data", (c) => chunks.push(c));
          res.on("end", () => {
            server.close();
            const raw = Buffer.concat(chunks).toString("utf8");
            resolve({
              status: res.statusCode ?? 0,
              body: raw.length > 0 ? JSON.parse(raw) : null,
            });
          });
        }
      );
      req.on("error", (err) => {
        server.close();
        reject(err);
      });
      if (payload) req.write(payload);
      req.end();
    });
  });
}

installMemoryStorageDriverForDescribe();

describe("phase-8.contract.spec.ts (Product Parity DoD)", () => {
  it("REQ-P8 genericity: platform-core diff empty vs phase-8 baseline", () => {
    assert.ok(readFileSync(BASELINE_YAML, "utf8").includes("phase-8"));
    const baselineSha = readBaselineSha();
    assertPlatformCoreUnchangedSinceBaseline(baselineSha);
  });

  it("REQ-P8 plugin boundary: urban satisfies WorkspacePlugin in workspace-urban only", () => {
    const plugin = getUrbanWorkspacePlugin();
    assert.equal(plugin.id, "urban");
    assert.equal(plugin.supportedWorkspaceTypes[0], "urban");
    assert.equal(isWorkspacePlugin(plugin), true);
    const cssPath = join(URBAN_PACKAGE, URBAN_THEME_TOKENS_STYLESHEET);
    assert.ok(readFileSync(cssPath, "utf8").includes("--ws-color-accent"));
    const urbanBranchHits = searchPlatformCore(/workspaceType\s*===\s*['"]urban['"]/);
    assert.deepEqual(urbanBranchHits, [], `forbidden urban branch in platform-core`);
  });

  it("INV-P8-007: member PATCH /urban/settings returns 403 URBAN_OWNER_REQUIRED (behavioral)", async () => {
    process.env.NODE_ENV = "test";
    process.env.AUTH_ALLOW_DEV_BEARER = "true";
    process.env.URBAN_TEST_WORKSPACE_TYPE = "urban";
    const listener = createUrbanSmokeListener();
    const response = await requestUrban(listener, "PATCH", "/urban/settings", {
      headers: { Authorization: memberBearer() },
      body: {
        urban: {
          catalog: { publicEnabled: true, slug: "catalog" },
          registration: { policy: "open" },
        },
      },
    });
    assert.equal(response.status, 403);
    assert.equal((response.body as { code?: string }).code, "URBAN_OWNER_REQUIRED");
  });

  it("REQ-P8 closure artifacts: subphase proof specs and COP docs exist", () => {
    const required = [
      "apps/api/test/urban-owner-ability.spec.ts",
      "apps/api/test/urban-catalog-registration.spec.ts",
      "apps/api/test/urban-silo-fixture.spec.ts",
      "apps/api/test/urban-e2e-http.spec.ts",
      "apps/web/tests/e2e/urban-e2e-integrity.spec.ts",
      "docs/phase-8/appendices/erip/8.3-cop-silo-tier-integration.md",
      "docs/phase-8/appendices/erip/8.4-cop-e2e-integrity.md",
      "reports/phase-8-genericity-baseline.yaml",
    ];
    for (const rel of required) {
      const abs = join(REPO_ROOT, rel);
      assert.ok(existsSync(abs), `missing: ${rel}`);
      assert.ok(readFileSync(abs, "utf8").length > 0, `empty: ${rel}`);
    }
  });
});
