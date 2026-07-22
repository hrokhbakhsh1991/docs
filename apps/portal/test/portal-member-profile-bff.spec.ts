/**
 * M2 — canonical member profile BFF
 * @see docs/phase-19/platform-portal-member-profile.mdoc
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  buildMemberProfileView,
  parseMemberProfilePatchBody,
  pickExposedMemberProfileFields,
  serializeMemberProfileCapabilities,
} from "../src/me/member-profile-bff.server";
import { resolveMemberProfileCapabilities } from "@app-tour/workspace-sdk";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

describe("member-profile-bff.server (M2)", () => {
  const denaliIdentity = {
    userId: "00000000-0000-4000-8000-000000000103",
    tenantId: "00000000-0000-4000-8000-000000000014",
    role: "member",
    displayName: "Portal Member",
    nationalId: "1234567890",
    fatherName: "Father",
    birthDate: "1990-05-15",
    email: "hidden@example.com",
    gender: "female",
  };

  it("MP-BFF-01 denali GET view exposes only capability fields", () => {
    const view = buildMemberProfileView(denaliIdentity, "denali");
    assert.equal(view.ok, true);
    if (!("ok" in view)) {
      return;
    }
    assert.equal(view.contractVersion, "v1");
    assert.deepEqual(Object.keys(view.profile.fields).sort(), [
      "birthDate",
      "displayName",
      "email",
      "fatherName",
      "gender",
      "mobile",
      "nationalId",
    ]);
    assert.equal(view.profile.fields.email, "hidden@example.com");
    assert.equal(view.profile.fields.displayName, "Portal Member");
    assert.equal(view.profile.fields.nationalId, "1234567890");
    assert.equal(view.profile.fields.gender, "female");
    assert.deepEqual(view.profile.capabilities.editableFields, [
      "displayName",
      "email",
      "gender",
      "nationalId",
      "fatherName",
      "birthDate",
    ]);
    assert.deepEqual(view.profile.capabilities.readOnlyFields, ["mobile"]);
    assert.equal(view.profile.capabilities.mobileChangeViaOtp, true);
    assert.equal(
      (view.profile.capabilities as { validators?: unknown }).validators,
      undefined
    );
  });

  it("MP-BFF-02 urban plugin exposes displayName + email only", () => {
    const view = buildMemberProfileView(
      {
        ...denaliIdentity,
        displayName: "Ada",
        email: "ada@example.com",
      },
      "urban"
    );
    assert.equal(view.ok, true);
    if (!("ok" in view)) {
      return;
    }
    assert.deepEqual(Object.keys(view.profile.fields).sort(), ["displayName", "email"]);
    assert.equal(view.profile.fields.nationalId, undefined);
  });

  it("MP-BFF-03 pickExposedMemberProfileFields omits non-registry fields", () => {
    const caps = resolveMemberProfileCapabilities("denali");
    const fields = pickExposedMemberProfileFields(denaliIdentity, caps);
    assert.equal(fields.email, "hidden@example.com");
    assert.equal(fields.mobile, null);
    assert.equal(fields.gender, "female");
  });

  it("MP-BFF-03b pickExposedMemberProfileFields returns null gender when unset", () => {
    const caps = resolveMemberProfileCapabilities("denali");
    const fields = pickExposedMemberProfileFields(
      { displayName: "Member", gender: undefined },
      caps
    );
    assert.equal(fields.gender, null);
  });

  it("MP-BFF-06 PATCH accepts editable displayName on denali", () => {
    const ok = parseMemberProfilePatchBody({ fields: { displayName: "New Name" } }, "denali");
    assert.ok("patch" in ok);
    if (!("patch" in ok)) {
      return;
    }
    assert.deepEqual(ok.patch, { displayName: "New Name" });
  });

  it("MP-BFF-07 PATCH rejects read-only mobile on denali", () => {
    const err = parseMemberProfilePatchBody({ fields: { mobile: "+15551234567" } }, "denali");
    assert.equal("code" in err && err.code, "PROFILE_FIELD_READ_ONLY");
    assert.equal("status" in err && err.status, 400);
  });

  it("MP-BFF-07b PATCH accepts editable email on denali", () => {
    const ok = parseMemberProfilePatchBody({ fields: { email: "member@example.com" } }, "denali");
    assert.ok("patch" in ok);
    if (!("patch" in ok)) {
      return;
    }
    assert.deepEqual(ok.patch, { email: "member@example.com" });
  });

  it("MP-BFF-07c PATCH accepts editable gender on denali", () => {
    const ok = parseMemberProfilePatchBody({ fields: { gender: "female" } }, "denali");
    assert.ok("patch" in ok);
    if (!("patch" in ok)) {
      return;
    }
    assert.deepEqual(ok.patch, { gender: "female" });
  });

  it("MP-BFF-07d PATCH rejects invalid gender on denali", () => {
    const err = parseMemberProfilePatchBody({ fields: { gender: "invalid" } }, "denali");
    assert.equal("code" in err && err.code, "PROFILE_GENDER_INVALID");
    assert.deepEqual("fieldErrors" in err && err.fieldErrors, {
      gender: "PROFILE_GENDER_INVALID",
    });
  });

  it("MP-BFF-04 serializeMemberProfileCapabilities strips validators", () => {
    const caps = resolveMemberProfileCapabilities("denali");
    const serialized = serializeMemberProfileCapabilities(caps);
    assert.equal((serialized as { validators?: unknown }).validators, undefined);
    assert.equal(typeof caps.validators.nationalId, "function");
  });

  it("MP-BFF-05 PATCH validates editable fields via SDK", () => {
    const ok = parseMemberProfilePatchBody(
      { fields: { nationalId: "1234567890", fatherName: "Ali" } },
      "denali"
    );
    assert.ok("patch" in ok);
    if (!("patch" in ok)) {
      return;
    }
    assert.deepEqual(ok.patch, { nationalId: "1234567890", fatherName: "Ali" });
  });

  it("MP-BFF-08 PATCH runs SDK validator codes with fieldErrors", () => {
    const err = parseMemberProfilePatchBody({ fields: { nationalId: "bad" } }, "denali");
    assert.equal("code" in err && err.code, "PROFILE_NATIONAL_ID_INVALID");
    assert.deepEqual("fieldErrors" in err && err.fieldErrors, {
      nationalId: "PROFILE_NATIONAL_ID_INVALID",
    });
  });

  it("MP-BFF-09 PATCH rejects empty body", () => {
    const err = parseMemberProfilePatchBody({ fields: {} }, "denali");
    assert.equal("code" in err && err.code, "EMPTY_PATCH");
  });

  it("MP-BFF-10 PATCH accepts null to clear optional field", () => {
    const ok = parseMemberProfilePatchBody({ fields: { nationalId: null } }, "denali");
    assert.ok("patch" in ok);
    if (!("patch" in ok)) {
      return;
    }
    assert.equal(ok.patch.nationalId, "");
  });

  it("MP-BFF-10b PATCH maps cleared gender to null upstream", () => {
    const ok = parseMemberProfilePatchBody({ fields: { gender: null } }, "denali");
    assert.ok("patch" in ok);
    if (!("patch" in ok)) {
      return;
    }
    assert.equal(ok.patch.gender, null);
  });

  it("MP-BFF-10c PATCH maps empty gender to null upstream", () => {
    const ok = parseMemberProfilePatchBody(
      { fields: { nationalId: "1234567890", gender: "" } },
      "denali"
    );
    assert.ok("patch" in ok);
    if (!("patch" in ok)) {
      return;
    }
    assert.deepEqual(ok.patch, { nationalId: "1234567890", gender: null });
  });

  it("MP-BFF-11 identity missing userId returns PROFILE_FETCH_FAILED", () => {
    const err = buildMemberProfileView({ tenantId: "t", role: "member" }, "denali");
    assert.equal("code" in err && err.code, "PROFILE_FETCH_FAILED");
    assert.equal("status" in err && err.status, 502);
  });
});

describe("portal-member-profile-bff route (M2)", () => {
  it("MP-BFF-12 route exports GET and PATCH", () => {
    const route = readFileSync(
      join(repoRoot, "apps/portal/app/api/me/profile/route.ts"),
      "utf8"
    );
    assert.match(route, /export async function GET/);
    assert.match(route, /export async function PATCH/);
    assert.match(route, /buildMemberProfileView/);
    assert.match(route, /parseMemberProfilePatchBody/);
    assert.match(route, /identity\/me/);
    assert.match(route, /resolvePortalBootstrapForHost/);
    assert.match(route, /buildMemberApiHeaders/);
  });

  describe("portal-member-profile M3 cutover", () => {
  it("MP-M3-01 profile page SSR uses fetchMemberProfile BFF only", () => {
    const page = readFileSync(join(repoRoot, "apps/portal/app/me/profile/page.tsx"), "utf8");
    const fetchModule = readFileSync(
      join(repoRoot, "apps/portal/src/me/fetch-member-profile.server.ts"),
      "utf8"
    );
    assert.match(page, /fetchMemberProfile/);
    assert.match(fetchModule, /\/api\/me\/profile/);
    assert.doesNotMatch(page, /identity\/me/);
    assert.doesNotMatch(page, /resolveTourOpsApiBaseUrl/);
  });

  it("MP-M3-02 member profile form is capability-driven and uses profile BFF", () => {
    const form = readFileSync(
      join(repoRoot, "apps/portal/app/me/profile/member-profile-form.tsx"),
      "utf8"
    );
    assert.match(form, /capabilities\.editableFields/);
    assert.match(form, /data-member-profile-field=/);
    assert.match(form, /data-member-profile-save/);
    assert.match(form, /\/api\/me\/profile/);
    assert.doesNotMatch(form, /session-profile/);
    assert.doesNotMatch(form, /\/\^\\d\{10\}/);
    assert.doesNotMatch(form, /nationalIdInvalid/);
  });

  it("MP-M3-03 registration auth steps hydrate intake from profile BFF", () => {
    const hydrate = readFileSync(
      join(
        repoRoot,
        "packages/catalog-registration-flow-ui/src/hydrate-intake-after-session.ts"
      ),
      "utf8"
    );
    assert.match(hydrate, /\/api\/me\/profile/);
    const flow = readFileSync(
      join(repoRoot, "apps/portal/src/catalog/public-catalog-registration-flow.tsx"),
      "utf8"
    );
    assert.doesNotMatch(flow, /session-profile/);
  });

  it("MP-M3-04 no identity/me in portal UI layer", () => {
    const mePaths = [
      "apps/portal/app/me/profile/page.tsx",
      "apps/portal/app/me/profile/member-profile-form.tsx",
      "apps/portal/src/catalog/public-catalog-registration-flow.tsx",
    ];
    for (const relativePath of mePaths) {
      const source = readFileSync(join(repoRoot, relativePath), "utf8");
      assert.doesNotMatch(source, /identity\/me/);
    }
  });

  it("MP-M4-01 session-profile route removed", () => {
    const sessionProfilePath = join(
      repoRoot,
      "apps/portal/app/api/public-auth/session-profile/route.ts"
    );
    assert.throws(() => readFileSync(sessionProfilePath, "utf8"));
  });

  it("MP-M4-02 portal member profile boundary guard passes", async () => {
    const { spawnSync } = await import("node:child_process");
    const result = spawnSync(
      "node",
      ["scripts/guards/guard-portal-member-profile-boundary.mjs"],
      { cwd: repoRoot, encoding: "utf8" }
    );
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /guard-portal-member-profile-boundary — PASS/);
  });
  });

  it("MP-BFF-14 BFF module has no workspace package imports beyond SDK", () => {
    const bff = readFileSync(
      join(repoRoot, "apps/portal/src/me/member-profile-bff.server.ts"),
      "utf8"
    );
    assert.match(bff, /@app-tour\/workspace-sdk/);
    assert.doesNotMatch(bff, /packages\/workspaces/);
    assert.doesNotMatch(bff, /pluginId === "denali"/);
  });
});

describe("member-profile M5 hardening", () => {
  it("MP-M5-01 unified API error includes code and message", async () => {
    const { buildMemberProfileApiError } = await import("../src/me/member-profile-contract.server");
    const body = buildMemberProfileApiError("PROFILE_NATIONAL_ID_INVALID", {
      nationalId: "PROFILE_NATIONAL_ID_INVALID",
    });
    assert.equal(body.ok, false);
    assert.equal(body.error.code, "PROFILE_NATIONAL_ID_INVALID");
    assert.match(body.error.message, /National ID/);
    assert.deepEqual(body.error.fieldErrors, {
      nationalId: "PROFILE_NATIONAL_ID_INVALID",
    });
  });

  it("MP-M5-02 cache stores and invalidates per tenant user plugin", async () => {
    const {
      buildMemberProfileCacheKey,
      clearMemberProfileCacheForTests,
      invalidateMemberProfileCache,
      readMemberProfileCache,
      writeMemberProfileCache,
    } = await import("../src/me/member-profile-cache.server");
    const { withMemberProfileContractVersion } = await import(
      "../src/me/member-profile-contract.server"
    );

    clearMemberProfileCacheForTests();
    const payload = withMemberProfileContractVersion({
      userId: "user-1",
      tenantId: "tenant-1",
      role: "member",
      fields: { displayName: "Ada" },
      capabilities: { editableFields: ["displayName"], readOnlyFields: ["email"] },
    });
    const key = buildMemberProfileCacheKey({
      tenantId: "tenant-1",
      userId: "user-1",
      pluginId: "denali",
    });
    assert.equal(readMemberProfileCache(key), null);
    writeMemberProfileCache(key, payload);
    assert.deepEqual(readMemberProfileCache(key), payload);
    invalidateMemberProfileCache(key);
    assert.equal(readMemberProfileCache(key), null);
  });

  it("MP-M5-03 route uses contract errors and cache modules", () => {
    const route = readFileSync(
      join(repoRoot, "apps/portal/app/api/me/profile/route.ts"),
      "utf8"
    );
    assert.match(route, /buildMemberProfileApiError/);
    assert.match(route, /readMemberProfileCache/);
    assert.match(route, /invalidateMemberProfileCache/);
    assert.match(route, /logMemberProfileEvent/);
    assert.doesNotMatch(route, /error: \{ code \}/);
  });
});

describe("member-profile M6 architecture lock", () => {
  it("MP-M6-01 contract snapshot aligns with SDK field ids", async () => {
    const { assertMemberProfileContractSnapshotAlignment } = await import(
      "../src/me/member-profile-contract-alignment.server"
    );
    assert.doesNotThrow(() => assertMemberProfileContractSnapshotAlignment());
  });

  it("MP-M6-02 cache store abstraction supports read write invalidate", async () => {
    const { createInMemoryMemberProfileCacheStore } = await import(
      "../src/me/member-profile-cache-store.server"
    );
    const { withMemberProfileContractVersion } = await import(
      "../src/me/member-profile-contract.server"
    );
    const store = createInMemoryMemberProfileCacheStore();
    const payload = withMemberProfileContractVersion({
      userId: "u",
      tenantId: "t",
      role: "member",
      fields: {},
      capabilities: { editableFields: [], readOnlyFields: [] },
    });
    const key = "v1:t:u:denali";
    assert.equal(store.read(key), null);
    store.write(key, payload);
    assert.deepEqual(store.read(key), payload);
    store.invalidate(key);
    assert.equal(store.read(key), null);
  });

  it("MP-M6-03 traceId resolves from request header or generates uuid", async () => {
    const { resolveMemberProfileTraceId, memberProfileTraceResponseHeaders } = await import(
      "../src/me/member-profile-trace.server"
    );
    const req = new Request("http://portal.test/api/me/profile", {
      headers: { "x-member-profile-trace-id": "trace-abc" },
    });
    assert.equal(resolveMemberProfileTraceId(req), "trace-abc");
    assert.equal(memberProfileTraceResponseHeaders("trace-abc")["x-member-profile-trace-id"], "trace-abc");
    assert.match(resolveMemberProfileTraceId(), /^[0-9a-f-]{36}$/i);
  });

  it("MP-M6-04 production freeze guard includes contract + trace enforcement", async () => {
    const { spawnSync } = await import("node:child_process");
    const result = spawnSync(
      "node",
      ["scripts/guards/guard-portal-member-profile-boundary.mjs"],
      { cwd: repoRoot, encoding: "utf8" }
    );
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const guardSource = readFileSync(
      join(repoRoot, "scripts/guards/guard-portal-member-profile-boundary.mjs"),
      "utf8"
    );
    assert.match(guardSource, /member-profile-contract-v1\.snapshot\.json/);
    assert.match(guardSource, /resolveMemberProfileTraceId/);
  });
});

describe("member-profile M7 architecture truth governance", () => {
  it("MP-M7-01 architecture-truth-guard passes with drift report", async () => {
    const { spawnSync } = await import("node:child_process");
    const result = spawnSync("node", ["scripts/guards/architecture-truth-guard.mjs"], {
      cwd: repoRoot,
      encoding: "utf8",
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const report = JSON.parse(
      readFileSync(join(repoRoot, "docs/phase-19/architecture-truth-drift-report.json"), "utf8")
    );
    assert.deepEqual(report.truthPriority, [
      "runtime_behavior",
      "api_bff_implementation",
      "sdk_contracts",
      "snapshot_schema",
      "documentation",
    ]);
    assert.equal(report.summary.high, 0);
  });

  it("MP-M7-02 runtime truth self-check is non-blocking and wired in profile BFF", async () => {
    const { runMemberProfileRuntimeTruthCheck } = await import(
      "../src/me/member-profile-runtime-truth.server"
    );
    assert.doesNotThrow(() => runMemberProfileRuntimeTruthCheck("trace-test"));
    assert.doesNotThrow(() => runMemberProfileRuntimeTruthCheck("trace-test"));

    const route = readFileSync(
      join(repoRoot, "apps/portal/app/api/me/profile/route.ts"),
      "utf8"
    );
    assert.match(route, /runMemberProfileRuntimeTruthCheck/);
    assert.match(route, /enforceMemberProfileRuntimeTruth/);
    assert.match(route, /enforceProfileArchitectureOrRespond/);
  });

  it("MP-M7-03 boundary guard delegates contract alignment to shared truth lib", () => {
    const guardSource = readFileSync(
      join(repoRoot, "scripts/guards/guard-portal-member-profile-boundary.mjs"),
      "utf8"
    );
    assert.match(guardSource, /collectContractAlignmentFindings/);
    assert.match(guardSource, /member-profile-runtime-truth\.server\.ts/);
  });

  it("MP-M7-04 doc sync script reports without mutating docs", async () => {
    const { spawnSync } = await import("node:child_process");
    const result = spawnSync("node", ["scripts/docs/check-architecture-doc-sync.mjs"], {
      cwd: repoRoot,
      encoding: "utf8",
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /check-architecture-doc-sync/);
  });
});

describe("member-profile M8 closed-loop enforcement", () => {
  it("MP-M8-01 warn mode allows aligned profile architecture", async () => {
    const {
      enforceMemberProfileRuntimeTruth,
      resolveMemberProfileEnforcementMode,
    } = await import("../src/me/member-profile-runtime-truth.server");
    const previousMode = process.env.MEMBER_PROFILE_ENFORCEMENT_MODE;
    process.env.MEMBER_PROFILE_ENFORCEMENT_MODE = "warn";
    try {
      assert.equal(resolveMemberProfileEnforcementMode(), "warn");
      const result = enforceMemberProfileRuntimeTruth({
        traceId: "trace-m8-warn",
        contractVersion: "v1",
        capabilities: {
          editableFields: ["displayName", "email", "nationalId", "fatherName", "birthDate"],
          readOnlyFields: ["mobile"],
        },
        mappedFieldIds: [
          "avatarUrl",
          "birthDate",
          "displayName",
          "email",
          "fatherName",
          "gender",
          "mobile",
          "nationalId",
        ],
        responseFieldIds: [
          "displayName",
          "email",
          "mobile",
          "nationalId",
          "fatherName",
          "birthDate",
        ],
      });
      assert.equal(result.ok, true);
    } finally {
      if (previousMode === undefined) {
        delete process.env.MEMBER_PROFILE_ENFORCEMENT_MODE;
      } else {
        process.env.MEMBER_PROFILE_ENFORCEMENT_MODE = previousMode;
      }
    }
  });

  it("MP-M8-02 strict mode rejects identity exposure mismatch", async () => {
    const { enforceMemberProfileRuntimeTruth } = await import(
      "../src/me/member-profile-runtime-truth.server"
    );
    const previousMode = process.env.MEMBER_PROFILE_ENFORCEMENT_MODE;
    process.env.MEMBER_PROFILE_ENFORCEMENT_MODE = "strict";
    try {
      const result = enforceMemberProfileRuntimeTruth({
        traceId: "trace-m8-strict",
        contractVersion: "v1",
        capabilities: {
          editableFields: ["nationalId"],
          readOnlyFields: ["displayName"],
        },
        mappedFieldIds: [
          "avatarUrl",
          "birthDate",
          "displayName",
          "email",
          "fatherName",
          "gender",
          "mobile",
          "nationalId",
        ],
        responseFieldIds: ["nationalId"],
      });
      assert.equal(result.ok, false);
      if (result.ok) {
        return;
      }
      assert.equal(result.code, "PROFILE_ARCHITECTURE_DRIFT_DETECTED");
      assert.equal(result.driftType, "identity_exposure_mismatch");
    } finally {
      if (previousMode === undefined) {
        delete process.env.MEMBER_PROFILE_ENFORCEMENT_MODE;
      } else {
        process.env.MEMBER_PROFILE_ENFORCEMENT_MODE = previousMode;
      }
    }
  });

  it("MP-M8-03 architecture-truth-guard includes semantic drift simulation", async () => {
    const { spawnSync } = await import("node:child_process");
    const result = spawnSync("node", ["scripts/guards/architecture-truth-guard.mjs"], {
      cwd: repoRoot,
      encoding: "utf8",
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const guardSource = readFileSync(
      join(repoRoot, "scripts/guards/architecture-truth-guard.mjs"),
      "utf8"
    );
    assert.match(guardSource, /collectSemanticDriftFindings/);
    const report = JSON.parse(
      readFileSync(join(repoRoot, "docs/phase-19/architecture-truth-drift-report.json"), "utf8")
    );
    assert.equal(report.summary.high, 0);
  });

  it("MP-M8-04 enforcement matrix documents warn vs strict modes", () => {
    const matrix = readFileSync(
      join(repoRoot, "docs/phase-19/member-profile-enforcement-matrix.md"),
      "utf8"
    );
    assert.match(matrix, /MEMBER_PROFILE_ENFORCEMENT_MODE=strict/);
    assert.match(matrix, /PROFILE_ARCHITECTURE_DRIFT_DETECTED/);
    assert.match(matrix, /enforcementMode/);
  });
});
