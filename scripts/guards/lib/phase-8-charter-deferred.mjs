#!/usr/bin/env node
/**
 * Phase 8 Sprint M — charter deferred guards (M1–M4).
 * @see docs/phase-8/phase-8-guards.md · TEMP/phase8-doc-95plus-plan.md § M
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { REPO_ROOT } from "./phase-8-hardening-artifacts.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FAIL_PREFIX = "FAIL P8-GUARD-CHARTER-DEFERRED:";

/**
 * @param {string} rel
 * @returns {Promise<string>}
 */
async function readRepoFile(rel) {
  return fs.readFile(path.join(REPO_ROOT, rel), "utf8");
}

/**
 * 8.1 CASL route / layer rows → spec case IDs (normative per TRACEABILITY-MATRIX-8.1).
 * @type {readonly { route: string; surface: string; bindings: readonly { caseId: string; specRel: string }[] }[]}
 */
const CASL_8_1_ROUTE_SPEC_BINDINGS = Object.freeze([
  {
    route: "GET /urban/settings",
    surface: "urban.settings.read",
    bindings: Object.freeze([
      { caseId: "ASM-8.1-001", specRel: "apps/api/test/urban-settings-patch.spec.ts" },
      { caseId: "API-8.1-05", specRel: "apps/api/test/urban-settings-patch.spec.ts" },
    ]),
  },
  {
    route: "PATCH /urban/settings",
    surface: "urban.settings.update",
    bindings: Object.freeze([
      { caseId: "API-8.1-04", specRel: "apps/api/test/urban-settings-patch.spec.ts" },
      { caseId: "API-8.1-05", specRel: "apps/api/test/urban-settings-patch.spec.ts" },
      { caseId: "SDK-8.1-01", specRel: "packages/workspaces/urban/test/urban-owner-ability.spec.ts" },
      { caseId: "SDK-8.1-02", specRel: "packages/workspaces/urban/test/urban-owner-ability.spec.ts" },
      { caseId: "SDK-8.1-03", specRel: "packages/workspaces/urban/test/urban-owner-ability.spec.ts" },
    ]),
  },
  {
    route: "assertWorkspaceOwner",
    surface: "urban.settings.update",
    bindings: Object.freeze([
      { caseId: "API-8.1-01", specRel: "apps/api/test/urban-owner-ability.spec.ts" },
      { caseId: "API-8.1-02", specRel: "apps/api/test/urban-owner-ability.spec.ts" },
      { caseId: "API-8.1-03", specRel: "apps/api/test/urban-owner-ability.spec.ts" },
    ]),
  },
  {
    route: "/settings/workspace-owner",
    surface: "urban.settings.read",
    bindings: Object.freeze([
      { caseId: "WEB-8.1-01", specRel: "apps/web/test/urban-owner-access.spec.ts" },
      { caseId: "WEB-8.1-02", specRel: "apps/web/test/urban-owner-access.spec.ts" },
      { caseId: "WEB-8.1-03", specRel: "apps/web/test/urban-owner-access.spec.ts" },
    ]),
  },
]);

/** @type {readonly string[]} */
const ROUTE_MATRIX_8_1_API_PATHS = Object.freeze([
  "GET /urban/settings",
  "PATCH /urban/settings",
]);

/** @type {readonly string[]} */
const DISPATCH_OUT_OF_SCOPE_8_1 = Object.freeze([
  "/urban/catalog",
  "/urban/registrations",
  "/urban/admin/catalog",
]);

/** @type {readonly string[]} */
const SMOKE_IDS = Object.freeze(["SMK-P8-01", "SMK-P8-02", "SMK-P8-03", "SMK-P8-04"]);

/**
 * @param {string} matrixMd
 * @param {string} reqId
 * @returns {string | null}
 */
function extractReqRow(matrixMd, reqId) {
  const re = new RegExp(
    `\\|\\s*\\*\\*${reqId.replace(/-/g, "\\-")}\\*\\*\\s*\\|[^\\n]+`,
    "m",
  );
  const match = re.exec(matrixMd);
  return match?.[0] ?? null;
}

/**
 * M1 — CASL 8.1 route rows ↔ spec case IDs on disk.
 * @returns {Promise<void>}
 */
export async function verifyOwnerAuthSpecs() {
  const caslRel = "docs/phase-8/appendices/CASL-URBAN-OWNER-SPEC.md";
  const casl = await readRepoFile(caslRel);

  if (!/Surface → route mapping \(verification\)/.test(casl)) {
    throw new Error(`${FAIL_PREFIX} ${caslRel} missing Surface → route mapping table`);
  }

  /** @type {Map<string, string>} */
  const specCache = new Map();

  for (const row of CASL_8_1_ROUTE_SPEC_BINDINGS) {
    if (!casl.includes(row.route) && !casl.includes(row.surface)) {
      throw new Error(
        `${FAIL_PREFIX} ${caslRel} missing route/surface binding for ${row.route} · ${row.surface}`,
      );
    }

    for (const { caseId, specRel } of row.bindings) {
      let content = specCache.get(specRel);
      if (content === undefined) {
        content = await readRepoFile(specRel);
        specCache.set(specRel, content);
      }
      if (!content.includes(caseId)) {
        throw new Error(
          `${FAIL_PREFIX} ${specRel} missing case ${caseId} for CASL row ${row.route}`,
        );
      }
    }
  }
}

/**
 * M2 — URBAN-ROUTE-MATRIX §C 8.1 paths ⊆ dispatch addendum; out-of-scope paths excluded.
 * @returns {Promise<void>}
 */
export async function verifyUrbanRoutesBound() {
  const matrixRel = "docs/phase-8/appendices/URBAN-ROUTE-MATRIX.md";
  const dispatchRel = "docs/phase-8/appendices/urban-api-dispatch-addendum.md";
  const matrix = await readRepoFile(matrixRel);
  const dispatch = await readRepoFile(dispatchRel);

  for (const route of ROUTE_MATRIX_8_1_API_PATHS) {
    const [, method, pathOnly] = route.match(/^(\w+)\s+(\S+)/) ?? [];
    if (!matrix.includes(pathOnly)) {
      throw new Error(`${FAIL_PREFIX} ${matrixRel} missing 8.1 path ${pathOnly}`);
    }
    if (!dispatch.includes(pathOnly)) {
      throw new Error(`${FAIL_PREFIX} ${dispatchRel} missing bound path ${pathOnly}`);
    }
    if (!dispatch.includes(`"${pathOnly}"`) && !dispatch.includes(`\`${pathOnly}\``)) {
      throw new Error(`${FAIL_PREFIX} ${dispatchRel} must cite literal path ${pathOnly}`);
    }
    if (method && !new RegExp(`method:\\s*"${method}"[\\s\\S]{0,120}path:\\s*"${pathOnly.replace(/\//g, "\\/")}"`).test(dispatch)) {
      throw new Error(
        `${FAIL_PREFIX} ${dispatchRel} missing ${method} ${pathOnly} DISPATCH_ROUTES pair`,
      );
    }
  }

  for (const outPath of DISPATCH_OUT_OF_SCOPE_8_1) {
    if (!dispatch.includes(outPath)) {
      throw new Error(`${FAIL_PREFIX} ${dispatchRel} out_of_scope_8_1 must list ${outPath}`);
    }
    if (new RegExp(`path:\\s*"${outPath.replace(/\//g, "\\/")}"`).test(dispatch)) {
      throw new Error(
        `${FAIL_PREFIX} ${dispatchRel} forbids dispatch binding for out-of-scope 8.1 path ${outPath}`,
      );
    }
  }
}

/**
 * M3 — SMK-P8-01..04 each has executable command in verification-matrix.
 * @returns {Promise<void>}
 */
export async function verifySmokeMapPresent() {
  const matrixRel = "docs/phase-8/audits/verification-matrix.md";
  const matrix = await readRepoFile(matrixRel);

  if (!/Smoke scenario command index \(SMK-P8\)/.test(matrix)) {
    throw new Error(`${FAIL_PREFIX} ${matrixRel} missing SMK-P8 smoke command index section`);
  }

  for (const smokeId of SMOKE_IDS) {
    if (!matrix.includes(smokeId)) {
      throw new Error(`${FAIL_PREFIX} ${matrixRel} missing ${smokeId}`);
    }
    const lines = matrix.split("\n").filter((line) => line.includes(smokeId));
    const hasCommand = lines.some((line) =>
      /pnpm|test:e2e|urban-e2e-http|exec node/.test(line),
    );
    if (!hasCommand) {
      throw new Error(
        `${FAIL_PREFIX} ${matrixRel} ${smokeId} row missing executable verification command`,
      );
    }
  }
}

/**
 * M4 — REQ-P8-010..012 rows cite spec anchors and on-disk test paths.
 * @returns {Promise<void>}
 */
export async function verifyVerificationMatrixHydrated() {
  const matrixRel = "docs/phase-8/audits/verification-matrix.md";
  const matrix = await readRepoFile(matrixRel);

  /** @type {readonly { reqId: string; specPattern: RegExp; testPaths: readonly string[] }[]} */
  const hydration = Object.freeze([
    {
      reqId: "REQ-P8-010",
      specPattern: /CASL-URBAN-OWNER-SPEC/,
      testPaths: Object.freeze(["packages/workspaces/urban/test/urban-owner-ability.spec.ts"]),
    },
    {
      reqId: "REQ-P8-011",
      specPattern: /8\.1-single-owner-auth/,
      testPaths: Object.freeze(["apps/web/test/urban-owner-access.spec.ts"]),
    },
    {
      reqId: "REQ-P8-012",
      specPattern: /CASL-URBAN-OWNER-SPEC/,
      testPaths: Object.freeze([
        "apps/api/test/urban-owner-ability.spec.ts",
        "apps/api/test/urban-settings-patch.spec.ts",
      ]),
    },
  ]);

  for (const { reqId, specPattern, testPaths } of hydration) {
    const row = extractReqRow(matrix, reqId);
    if (!row) {
      throw new Error(`${FAIL_PREFIX} ${matrixRel} missing row ${reqId}`);
    }
    if (!specPattern.test(row)) {
      throw new Error(`${FAIL_PREFIX} ${matrixRel} ${reqId} spec file anchor missing`);
    }
    for (const testPath of testPaths) {
      const base = path.basename(testPath);
      if (!row.includes(base)) {
        throw new Error(
          `${FAIL_PREFIX} ${matrixRel} ${reqId} verification command must cite ${base}`,
        );
      }
      try {
        await fs.stat(path.join(REPO_ROOT, testPath));
      } catch {
        throw new Error(`${FAIL_PREFIX} ${reqId} target missing on disk: ${testPath}`);
      }
    }
  }
}

/**
 * M5 — boundary diff hook script present and documented.
 * @returns {Promise<void>}
 */
export async function verifyBoundaryCiHook() {
  const scriptRel = "scripts/guards/p8-boundary-diff.mjs";
  const guardsRel = "docs/phase-8/phase-8-guards.md";
  const boundaryRel = "docs/phase-8/appendices/PHASE-BOUNDARY-MATRIX.yaml";

  try {
    const st = await fs.stat(path.join(REPO_ROOT, scriptRel));
    if (!st.isFile()) {
      throw new Error(`${FAIL_PREFIX} ${scriptRel} is not a file`);
    }
  } catch {
    throw new Error(`${FAIL_PREFIX} missing ${scriptRel} — Sprint M5 CI hook`);
  }

  const guards = await readRepoFile(guardsRel);
  if (!guards.includes("p8-boundary-diff.mjs")) {
    throw new Error(`${FAIL_PREFIX} ${guardsRel} must document p8-boundary-diff.mjs`);
  }
  if (!/guard:p8-boundary-diff|p8-boundary-diff\.mjs/.test(guards)) {
    throw new Error(`${FAIL_PREFIX} ${guardsRel} missing guard:p8-boundary-diff invocation`);
  }

  const boundary = await readRepoFile(boundaryRel);
  if (!boundary.includes("p8-boundary-diff.mjs")) {
    throw new Error(`${FAIL_PREFIX} ${boundaryRel} must cite p8-boundary-diff.mjs ci_hook`);
  }
}
