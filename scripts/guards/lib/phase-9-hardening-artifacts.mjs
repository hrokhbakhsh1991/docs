#!/usr/bin/env node
/**
 * Phase 9.1 — hardening artifact presence and spec scaffold integrity.
 * @see docs/phase-9/appendices/SPEC-REGISTRY-9.1.yaml
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(__dirname, "../../..");

export const PHASE9_CHARTER_GATES = 32;

export const SPEC_REGISTRY_REL = "docs/phase-9/appendices/SPEC-REGISTRY-9.1.yaml";

/** @type {readonly string[]} */
export const REQUIRED_PHASE9_9_1_SPEC_REGISTRY = Object.freeze([
  "apps/api/test/identity-otp.spec.ts",
  "apps/api/test/identity-session.spec.ts",
  "packages/workspace-sdk/test/operator-ability.spec.ts",
  "apps/web/test/auth-login-access.spec.ts",
  "apps/web/test/admin-shell-access.spec.ts",
]);

/** @type {readonly string[]} */
export const REQUIRED_PHASE9_HARDENING_ARTIFACTS = Object.freeze([
  "docs/phase-9/appendices/schemas/IDENTITY-HTTP-ENVELOPE.yaml",
  "docs/phase-9/appendices/schemas/IDENTITY-SESSION-RESPONSE.schema.json",
  "docs/phase-9/appendices/PHASE-BOUNDARY-MATRIX.md",
  "docs/phase-9/appendices/SPEC-REGISTRY-9.1.yaml",
  "docs/phase-9/appendices/AGENT-STATE-MAP-9.1.yaml",
  "docs/phase-9/appendices/TRACEABILITY-MATRIX-9.1.md",
  "docs/phase-9/appendices/TRACEABILITY-MATRIX-9.5.md",
  "docs/phase-9/appendices/TRACEABILITY-MATRIX-9.6.md",
  "docs/phase-9/appendices/CASL-OPERATOR-SPEC.md",
  "docs/phase-9/appendices/IDENTITY-PORT-SCOPE.md",
  "docs/phase-9/appendices/OPERATOR-LOGIN-FLOW.md",
  "docs/phase-9/appendices/identity-web-bff-addendum.md",
  "docs/phase-9/appendices/identity-api-dispatch-addendum.md",
  "docs/phase-9/appendices/schemas/IDENTITY-OTP-REQUEST.schema.json",
  "docs/phase-9/appendices/schemas/IDENTITY-OTP-VERIFY.schema.json",
  "docs/phase-9/appendices/FORENSIC-RUBRIC-P9.md",
  "docs/phase-9/appendices/ADVERSARIAL-MATRIX-P9.md",
  "docs/phase-9/appendices/settings-api-dispatch-addendum.md",
  "docs/phase-9/appendices/bookings-api-dispatch-addendum.md",
  "docs/phase-9/appendices/BOOKINGS-OPS-UX.md",
  "docs/phase-9/appendices/ADMIN-SHELL-UX.md",
  "docs/phase-9/appendices/TOURS-LIST-UX.md",
  "docs/phase-9/appendices/USERS-DIRECTORY-UX.md",
  "docs/phase-9/appendices/TRACEABILITY-MATRIX-9.4.md",
  "docs/phase-9/appendices/FINANCE-OPS-UX.md",
  "docs/phase-9/appendices/TRACEABILITY-MATRIX-9.7.md",
  "docs/phase-9/appendices/FINANCE-RISK-REGISTER-P9.md",
  "docs/phase-9/appendices/SETTINGS-MODULE-REGISTRY.md",
  "docs/phase-9/appendices/SETTINGS-RISK-REGISTER-P9.md",
  "docs/phase-9/appendices/AGENT-STATE-MAP-9.6.md",
  "docs/phase-9/appendices/finance-api-dispatch-addendum.md",
  "docs/phase-9/appendices/AGENT-STATE-MAP-9.4.md",
  "docs/phase-9/appendices/AGENT-STATE-MAP-9.5.md",
]);

/**
 * @param {string} rel
 * @returns {Promise<string>}
 */
async function readRepoFile(rel) {
  return fs.readFile(path.join(REPO_ROOT, rel), "utf8");
}

/**
 * @param {string} rel
 * @returns {Promise<{ ok: boolean; detail: string | null }>}
 */
async function verifySpecScaffold(rel) {
  try {
    const content = await readRepoFile(rel);
    const hasDescribe = /\bdescribe\s*\(/.test(content);
    const hasIt = /\bit\s*\(/.test(content);
    const hasExpect =
      /\bassert\.(equal|fail|match)\(/.test(content) ||
      /\bexpect\s*\(/.test(content) ||
      /\.toBe\s*\(/.test(content);
    if (!hasDescribe || !hasIt || !hasExpect) {
      return {
        ok: false,
        detail: `${rel} missing describe/it/assert scaffold`,
      };
    }
    return { ok: true, detail: null };
  } catch {
    return { ok: false, detail: `missing ${rel}` };
  }
}

/**
 * Settings registry doc pack (DEC-P9-009 · DEC-P9-010).
 * @returns {Promise<{ ok: boolean; detail: string | null }>}
 */
export async function verifySettingsRegistryPack() {
  const decisions = await readRepoFile("docs/phase-9/appendices/IMPLEMENTATION-DECISIONS.md");
  if (!decisions.includes("DEC-P9-009") || !decisions.includes("DEC-P9-010")) {
    return { ok: false, detail: "missing DEC-P9-009 or DEC-P9-010 in IMPLEMENTATION-DECISIONS" };
  }
  const registry = await readRepoFile("docs/phase-9/appendices/SETTINGS-MODULE-REGISTRY.md");
  for (const token of ["operatorSettings", "reference_data", "tenant_config", "DEC-P9-010"]) {
    if (!registry.includes(token)) {
      return { ok: false, detail: `SETTINGS-MODULE-REGISTRY missing ${token}` };
    }
  }
  const risks = await readRepoFile("docs/phase-9/appendices/SETTINGS-RISK-REGISTER-P9.md");
  for (const id of ["R-P9-S01", "R-P9-S03", "R-P9-S07", "R-P9-S08"]) {
    if (!risks.includes(id)) {
      return { ok: false, detail: `SETTINGS-RISK-REGISTER missing ${id}` };
    }
  }
  const dispatch = await readRepoFile("docs/phase-9/appendices/settings-api-dispatch-addendum.md");
  if (!dispatch.includes("/settings/resources/{moduleId}") || !dispatch.includes("2026-06-08-v2")) {
    return { ok: false, detail: "settings-api-dispatch-addendum v2 resource router missing" };
  }
  return { ok: true, detail: null };
}

/**
 * Registration Command Center doc pack (DEC-P9-011).
 * @returns {Promise<{ ok: boolean; detail: string | null }>}
 */
export async function verifyBookingsOpsPack() {
  const decisions = await readRepoFile("docs/phase-9/appendices/IMPLEMENTATION-DECISIONS.md");
  if (!decisions.includes("DEC-P9-011")) {
    return { ok: false, detail: "missing DEC-P9-011 in IMPLEMENTATION-DECISIONS" };
  }
  const ux = await readRepoFile("docs/phase-9/appendices/BOOKINGS-OPS-UX.md");
  for (const token of [
    "RegistrationOpsManifest",
    "inbox_table",
    "Registration Command Center",
    "DEC-P9-011",
  ]) {
    if (!ux.includes(token)) {
      return { ok: false, detail: `BOOKINGS-OPS-UX missing ${token}` };
    }
  }
  const dispatch = await readRepoFile("docs/phase-9/appendices/bookings-api-dispatch-addendum.md");
  if (!dispatch.includes("2026-06-08-v2") || !dispatch.includes("/bookings/summary")) {
    return { ok: false, detail: "bookings-api-dispatch-addendum v2 summary route missing" };
  }
  return { ok: true, detail: null };
}

/**
 * Tours list UX doc pack (DEC-P9-014).
 * @returns {Promise<{ ok: boolean; detail: string | null }>}
 */
export async function verifyToursListPack() {
  const decisions = await readRepoFile("docs/phase-9/appendices/IMPLEMENTATION-DECISIONS.md");
  if (!decisions.includes("DEC-P9-014")) {
    return { ok: false, detail: "missing DEC-P9-014 in IMPLEMENTATION-DECISIONS" };
  }
  const ux = await readRepoFile("docs/phase-9/appendices/TOURS-LIST-UX.md");
  for (const token of [
    "TourListProjection",
    "view=operator",
    "mobile-first",
    "DEC-P9-014",
    "query-model",
    "extractTourListProjection",
  ]) {
    if (!ux.includes(token)) {
      return { ok: false, detail: `TOURS-LIST-UX missing ${token}` };
    }
  }
  const dispatch = await readRepoFile(
    "docs/phase-9/appendices/tours-operator-api-dispatch-addendum.md"
  );
  if (!dispatch.includes("2026-06-08-v2") || !dispatch.includes("view=operator")) {
    return { ok: false, detail: "tours-operator-api-dispatch-addendum v2 incomplete" };
  }
  try {
    await fs.access(
      path.join(REPO_ROOT, "docs/phase-9/appendices/schemas/TOURS-LIST-PROJECTION.schema.json")
    );
  } catch {
    return { ok: false, detail: "missing TOURS-LIST-PROJECTION.schema.json" };
  }
  const trace = await readRepoFile("docs/phase-9/appendices/TRACEABILITY-MATRIX-9.3.md");
  if (!trace.includes("REQ-P9-030") || !trace.includes("DEC-P9-014")) {
    return { ok: false, detail: "TRACEABILITY-MATRIX-9.3 incomplete" };
  }
  return { ok: true, detail: null };
}

/**
 * Finance command center doc pack (DEC-P9-016).
 * @returns {Promise<{ ok: boolean; detail: string | null }>}
 */
export async function verifyFinanceOpsPack() {
  const decisions = await readRepoFile("docs/phase-9/appendices/IMPLEMENTATION-DECISIONS.md");
  if (!decisions.includes("DEC-P9-016")) {
    return { ok: false, detail: "missing DEC-P9-016 in IMPLEMENTATION-DECISIONS" };
  }
  const ux = await readRepoFile("docs/phase-9/appendices/FINANCE-OPS-UX.md");
  for (const token of [
    "FinanceOpsManifest",
    "PaymentScheduleItem",
    "registration_prepayment",
    "mobile-first",
    "DEC-P9-016",
    "installments",
    "double_entry_applied",
  ]) {
    if (!ux.includes(token)) {
      return { ok: false, detail: `FINANCE-OPS-UX missing ${token}` };
    }
  }
  const dispatch = await readRepoFile("docs/phase-9/appendices/finance-api-dispatch-addendum.md");
  if (!dispatch.includes("2026-06-08-v2") || !dispatch.includes("/finance/prepayments")) {
    return { ok: false, detail: "finance-api-dispatch-addendum v2 incomplete" };
  }
  try {
    await fs.access(
      path.join(REPO_ROOT, "docs/phase-9/appendices/schemas/PAYMENT-SCHEDULE-ITEM.schema.json")
    );
  } catch {
    return { ok: false, detail: "missing PAYMENT-SCHEDULE-ITEM.schema.json" };
  }
  const sub = await readRepoFile("docs/phase-9/subphases/9.7-finance-denali.md");
  if (!sub.includes("DEC-P9-016") || !sub.includes("CP-9.7-10")) {
    return { ok: false, detail: "9.7-finance-denali.md missing DEC-P9-016 or CP-9.7-10" };
  }
  const trace = await readRepoFile("docs/phase-9/appendices/TRACEABILITY-MATRIX-9.7.md");
  if (!trace.includes("REQ-P9-070") || !trace.includes("DEC-P9-016")) {
    return { ok: false, detail: "TRACEABILITY-MATRIX-9.7 incomplete" };
  }
  const risks = await readRepoFile("docs/phase-9/appendices/FINANCE-RISK-REGISTER-P9.md");
  if (!risks.includes("R-P9-F01") || !risks.includes("R-P9-F08")) {
    return { ok: false, detail: "FINANCE-RISK-REGISTER-P9 incomplete" };
  }
  return { ok: true, detail: null };
}

/**
 * Users directory UX doc pack (DEC-P9-015).
 * @returns {Promise<{ ok: boolean; detail: string | null }>}
 */
export async function verifyUsersDirectoryPack() {
  const decisions = await readRepoFile("docs/phase-9/appendices/IMPLEMENTATION-DECISIONS.md");
  if (!decisions.includes("DEC-P9-015")) {
    return { ok: false, detail: "missing DEC-P9-015 in IMPLEMENTATION-DECISIONS" };
  }
  const ux = await readRepoFile("docs/phase-9/appendices/USERS-DIRECTORY-UX.md");
  for (const token of [
    "WorkspaceDirectoryRow",
    "isAdminOrOwner",
    "mobile-first",
    "DEC-P9-015",
    "admin-denied",
    "InvitableWorkspaceRole",
  ]) {
    if (!ux.includes(token)) {
      return { ok: false, detail: `USERS-DIRECTORY-UX missing ${token}` };
    }
  }
  const dispatch = await readRepoFile("docs/phase-9/appendices/users-api-dispatch-addendum.md");
  if (!dispatch.includes("2026-06-08-v2") || !dispatch.includes("InvitableWorkspaceRole")) {
    return { ok: false, detail: "users-api-dispatch-addendum v2 incomplete" };
  }
  try {
    await fs.access(
      path.join(REPO_ROOT, "docs/phase-9/appendices/schemas/USERS-DIRECTORY-ROW.schema.json")
    );
  } catch {
    return { ok: false, detail: "missing USERS-DIRECTORY-ROW.schema.json" };
  }
  const sub = await readRepoFile("docs/phase-9/subphases/9.4-users-rbac.md");
  if (!sub.includes("DEC-P9-015") || !sub.includes("CP-9.4-09")) {
    return { ok: false, detail: "9.4-users-rbac.md missing DEC-P9-015 or CP-9.4-09" };
  }
  const trace = await readRepoFile("docs/phase-9/appendices/TRACEABILITY-MATRIX-9.4.md");
  if (!trace.includes("REQ-P9-040") || !trace.includes("DEC-P9-015")) {
    return { ok: false, detail: "TRACEABILITY-MATRIX-9.4 incomplete" };
  }
  return { ok: true, detail: null };
}

/**
 * Admin shell UX doc pack (DEC-P9-013).
 * @returns {Promise<{ ok: boolean; detail: string | null }>}
 */
export async function verifyAdminShellPack() {
  const decisions = await readRepoFile("docs/phase-9/appendices/IMPLEMENTATION-DECISIONS.md");
  if (!decisions.includes("DEC-P9-013")) {
    return { ok: false, detail: "missing DEC-P9-013 in IMPLEMENTATION-DECISIONS" };
  }
  const ux = await readRepoFile("docs/phase-9/appendices/ADMIN-SHELL-UX.md");
  for (const token of [
    "mobile-first",
    "OperatorShell",
    "ui-primitives",
    "DEC-P9-013",
    "operator-drawer",
    "48rem",
  ]) {
    if (!ux.includes(token)) {
      return { ok: false, detail: `ADMIN-SHELL-UX missing ${token}` };
    }
  }
  const sub = await readRepoFile("docs/phase-9/subphases/9.2-admin-shell.md");
  if (!sub.includes("DEC-P9-013") || !sub.includes("CP-9.2-05")) {
    return { ok: false, detail: "9.2-admin-shell.md missing DEC-P9-013 or CP-9.2-05" };
  }
  const trace = await readRepoFile("docs/phase-9/appendices/TRACEABILITY-MATRIX-9.2.md");
  if (!trace.includes("REQ-P9-020") || !trace.includes("DEC-P9-013")) {
    return { ok: false, detail: "TRACEABILITY-MATRIX-9.2 incomplete" };
  }
  return { ok: true, detail: null };
}

/**
 * Operator login flow doc pack (DEC-P9-012).
 * @returns {Promise<{ ok: boolean; detail: string | null }>}
 */
export async function verifyIdentityLoginPack() {
  const decisions = await readRepoFile("docs/phase-9/appendices/IMPLEMENTATION-DECISIONS.md");
  if (!decisions.includes("DEC-P9-012")) {
    return { ok: false, detail: "missing DEC-P9-012 in IMPLEMENTATION-DECISIONS" };
  }
  const flow = await readRepoFile("docs/phase-9/appendices/OPERATOR-LOGIN-FLOW.md");
  for (const token of [
    "login-web-session",
    "membership-ability-context",
    "sessionVersion",
    "DEC-P9-012",
    "604800",
  ]) {
    if (!flow.includes(token)) {
      return { ok: false, detail: `OPERATOR-LOGIN-FLOW missing ${token}` };
    }
  }
  const bff = await readRepoFile("docs/phase-9/appendices/identity-web-bff-addendum.md");
  if (!bff.includes("/api/auth/request-otp") || !bff.includes("/api/auth/logout")) {
    return { ok: false, detail: "identity-web-bff-addendum incomplete" };
  }
  const dispatch = await readRepoFile("docs/phase-9/appendices/identity-api-dispatch-addendum.md");
  if (!dispatch.includes("2026-06-08-v2") || !dispatch.includes("/auth/ability-context")) {
    return { ok: false, detail: "identity-api-dispatch-addendum v2 ability-context missing" };
  }
  const scope = await readRepoFile("docs/phase-9/appendices/IDENTITY-PORT-SCOPE.md");
  if (scope.includes("UserSession") && scope.includes("Server-side session")) {
    return { ok: false, detail: "IDENTITY-PORT-SCOPE still references UserSession SoT" };
  }
  return { ok: true, detail: null };
}

/**
 * @returns {Promise<{ ok: boolean; detail: string | null }>}
 */
export async function verifyHardeningArtifacts() {
  for (const rel of REQUIRED_PHASE9_HARDENING_ARTIFACTS) {
    try {
      await fs.access(path.join(REPO_ROOT, rel));
    } catch {
      return { ok: false, detail: `missing hardening artifact ${rel}` };
    }
  }
  const settingsPack = await verifySettingsRegistryPack();
  if (!settingsPack.ok) return settingsPack;
  const bookingsPack = await verifyBookingsOpsPack();
  if (!bookingsPack.ok) return bookingsPack;
  const identityLoginPack = await verifyIdentityLoginPack();
  if (!identityLoginPack.ok) return identityLoginPack;
  const adminShellPack = await verifyAdminShellPack();
  if (!adminShellPack.ok) return adminShellPack;
  const toursListPack = await verifyToursListPack();
  if (!toursListPack.ok) return toursListPack;
  const usersDirectoryPack = await verifyUsersDirectoryPack();
  if (!usersDirectoryPack.ok) return usersDirectoryPack;
  const financeOpsPack = await verifyFinanceOpsPack();
  if (!financeOpsPack.ok) return financeOpsPack;
  return { ok: true, detail: null };
}

/**
 * @returns {Promise<{ ok: boolean; detail: string | null }>}
 */
export async function verifySpecPathRegistry() {
  for (const rel of REQUIRED_PHASE9_9_1_SPEC_REGISTRY) {
    const r = await verifySpecScaffold(rel);
    if (!r.ok) return r;
  }
  return { ok: true, detail: null };
}

/**
 * @returns {Promise<{ ok: boolean; detail: string | null }>}
 */
export async function verifyProveWithParity() {
  const registry = await readRepoFile(SPEC_REGISTRY_REL);
  for (const rel of REQUIRED_PHASE9_9_1_SPEC_REGISTRY) {
    if (!registry.includes(rel)) {
      return { ok: false, detail: `SPEC-REGISTRY-9.1 missing ${rel}` };
    }
  }
  const manifest = await readRepoFile("docs/phase-9/appendices/BOOT-MANIFEST.yaml");
  if (
    !manifest.includes("identity-otp.spec.ts") ||
    !manifest.includes("operator-ability.spec.ts")
  ) {
    return { ok: false, detail: "BOOT-MANIFEST 9.1 prove_with missing identity specs" };
  }
  return { ok: true, detail: null };
}

/**
 * @returns {Promise<{ ok: boolean; detail: string | null }>}
 */
export async function verifyTraceabilityPresent() {
  const rel91 = "docs/phase-9/appendices/TRACEABILITY-MATRIX-9.1.md";
  const raw91 = await readRepoFile(rel91);
  for (const id of ["REQ-P9-010", "REQ-P9-011", "INV-P9-007", "P9-1-A03"]) {
    if (!raw91.includes(id)) {
      return { ok: false, detail: `TRACEABILITY-MATRIX-9.1 missing ${id}` };
    }
  }
  const rel96 = "docs/phase-9/appendices/TRACEABILITY-MATRIX-9.6.md";
  const raw96 = await readRepoFile(rel96);
  for (const id of ["REQ-P9-060", "REQ-P9-062", "P9-6-A01", "R-P9-S07"]) {
    if (!raw96.includes(id)) {
      return { ok: false, detail: `TRACEABILITY-MATRIX-9.6 missing ${id}` };
    }
  }
  const rel95 = "docs/phase-9/appendices/TRACEABILITY-MATRIX-9.5.md";
  const raw95 = await readRepoFile(rel95);
  for (const id of ["REQ-P9-050", "REQ-P9-052", "P9-5-A05", "DEC-P9-011"]) {
    if (!raw95.includes(id)) {
      return { ok: false, detail: `TRACEABILITY-MATRIX-9.5 missing ${id}` };
    }
  }
  const rel92 = "docs/phase-9/appendices/TRACEABILITY-MATRIX-9.2.md";
  const raw92 = await readRepoFile(rel92);
  for (const id of ["REQ-P9-020", "REQ-P9-021", "P9-2-A01", "DEC-P9-013"]) {
    if (!raw92.includes(id)) {
      return { ok: false, detail: `TRACEABILITY-MATRIX-9.2 missing ${id}` };
    }
  }
  const rel93 = "docs/phase-9/appendices/TRACEABILITY-MATRIX-9.3.md";
  const raw93 = await readRepoFile(rel93);
  for (const id of ["REQ-P9-030", "REQ-P9-031", "P9-3-A01", "DEC-P9-014"]) {
    if (!raw93.includes(id)) {
      return { ok: false, detail: `TRACEABILITY-MATRIX-9.3 missing ${id}` };
    }
  }
  const rel94 = "docs/phase-9/appendices/TRACEABILITY-MATRIX-9.4.md";
  const raw94 = await readRepoFile(rel94);
  for (const id of ["REQ-P9-040", "REQ-P9-041", "REQ-P9-042", "DEC-P9-015"]) {
    if (!raw94.includes(id)) {
      return { ok: false, detail: `TRACEABILITY-MATRIX-9.4 missing ${id}` };
    }
  }
  const rel97 = "docs/phase-9/appendices/TRACEABILITY-MATRIX-9.7.md";
  const raw97 = await readRepoFile(rel97);
  for (const id of ["REQ-P9-070", "REQ-P9-071", "REQ-P9-073", "DEC-P9-016"]) {
    if (!raw97.includes(id)) {
      return { ok: false, detail: `TRACEABILITY-MATRIX-9.7 missing ${id}` };
    }
  }
  return { ok: true, detail: null };
}

/**
 * @returns {Promise<{ ok: boolean; detail: string | null }>}
 */
export async function verifyOperatorSpecDepth() {
  const rel = "docs/phase-9/appendices/CASL-OPERATOR-SPEC.md";
  const raw = await readRepoFile(rel);
  const required = [
    "requireOperatorSession",
    "OperatorSurface",
    "operator.settings.",
    "IDENTITY_REQUIRED",
    "SDK-9.1-01",
    "isWorkspaceOwner",
  ];
  for (const token of required) {
    if (!raw.includes(token)) {
      return { ok: false, detail: `CASL-OPERATOR-SPEC missing ${token}` };
    }
  }
  return { ok: true, detail: null };
}

/**
 * @returns {Promise<{ ok: boolean; detail: string | null }>}
 */
export async function verifyForbiddenCatalog() {
  const rel = "docs/phase-9/audits/verification-matrix.md";
  const raw = await readRepoFile(rel);
  for (const id of ["P9-F-001", "P9-F-002", "P9-F-009"]) {
    if (!raw.includes(id)) {
      return { ok: false, detail: `verification-matrix missing ${id}` };
    }
  }
  return { ok: true, detail: null };
}

/**
 * @returns {Promise<{ ok: boolean; detail: string | null }>}
 */
export async function verifyProductScopeOutList() {
  const rel = "docs/phase-9/appendices/OPERATOR-PRODUCT-SCOPE.md";
  const raw = await readRepoFile(rel);
  if (!raw.includes("permanent_out_of_scope") || !raw.includes("leader/review")) {
    return {
      ok: false,
      detail: "OPERATOR-PRODUCT-SCOPE missing permanent_out_of_scope / leader/review",
    };
  }
  if (!raw.includes("full_app_parity_inventory") || !raw.includes("DEC-P9-008")) {
    return {
      ok: false,
      detail: "OPERATOR-PRODUCT-SCOPE missing full_app_parity_inventory (DEC-P9-008)",
    };
  }
  return { ok: true, detail: null };
}

/**
 * @returns {Promise<{ ok: boolean; detail: string | null }>}
 */
export async function verifyDecP9Routing() {
  const rel = "docs/phase-9/appendices/IMPLEMENTATION-DECISIONS.md";
  const raw = await readRepoFile(rel);
  if (!raw.includes("DEC-P9-007")) {
    return { ok: false, detail: "missing DEC-P9-007 wizard routing" };
  }
  return { ok: true, detail: null };
}

/**
 * @returns {Promise<{ ok: boolean; detail: string | null }>}
 */
export async function verifyTraceabilityMap() {
  const rel = "docs/phase-9/appendices/TRACEABILITY-MAP.md";
  const raw = await readRepoFile(rel);
  for (const token of ["REQ-P9-083", "SMK-P9-02", "Closure verification bundle"]) {
    if (!raw.includes(token)) {
      return { ok: false, detail: `TRACEABILITY-MAP missing ${token}` };
    }
  }
  return { ok: true, detail: null };
}

/**
 * @returns {Promise<{ ok: boolean; detail: string | null }>}
 */
export async function verifyBoundaryMatrixDepth() {
  const rel = "docs/phase-9/appendices/PHASE-BOUNDARY-MATRIX.md";
  const raw = await readRepoFile(rel);
  for (const token of ["subphase_9_2_boundaries", "subphase_9_3_boundaries", "global_forbidden"]) {
    if (!raw.includes(token)) {
      return { ok: false, detail: `PHASE-BOUNDARY-MATRIX missing ${token}` };
    }
  }
  return { ok: true, detail: null };
}

/**
 * @returns {Promise<{ ok: boolean; detail: string | null }>}
 */
export async function verifyOperatorSpecRegistry() {
  const rel = "docs/phase-9/appendices/SPEC-REGISTRY-OPERATOR.yaml";
  const raw = await readRepoFile(rel);
  for (const path of [
    "apps/web/test/phase-9.contract.spec.ts",
    "apps/web/test/operator-smoke.spec.ts",
    "specs_9_3",
  ]) {
    if (!raw.includes(path)) {
      return { ok: false, detail: `SPEC-REGISTRY-OPERATOR missing ${path}` };
    }
  }
  return { ok: true, detail: null };
}

/** @type {readonly string[]} */
export const REQUIRED_PHASE9_ERIP_COPS = Object.freeze([
  "docs/phase-9/appendices/erip/9.1-cop-identity-port.md",
  "docs/phase-9/appendices/erip/9.2-cop-admin-shell.md",
  "docs/phase-9/appendices/erip/9.3-cop-tours-operator.md",
  "docs/phase-9/appendices/erip/9.4-cop-users-rbac.md",
  "docs/phase-9/appendices/erip/9.5-cop-bookings-ops.md",
  "docs/phase-9/appendices/erip/9.6-cop-settings-templates.md",
  "docs/phase-9/appendices/erip/9.7-cop-finance-denali.md",
  "docs/phase-9/appendices/erip/9.8-cop-operator-dod.md",
]);

/**
 * @returns {Promise<{ ok: boolean; detail: string | null }>}
 */
export async function verifyEripCopDepth() {
  for (const rel of REQUIRED_PHASE9_ERIP_COPS) {
    try {
      const raw = await readRepoFile(rel);
      if (!/cop_id:\s*COP-P9-/.test(raw)) {
        return { ok: false, detail: `${rel} missing cop_id front-matter` };
      }
      if (!/F-9\.\d+-/.test(raw)) {
        return { ok: false, detail: `${rel} missing F-9.* failure modes` };
      }
    } catch {
      return { ok: false, detail: `missing ${rel}` };
    }
  }
  return { ok: true, detail: null };
}

/**
 * @returns {Promise<{ ok: boolean; detail: string | null }>}
 */
export async function verifyForensicRubric() {
  const rubric = await readRepoFile("docs/phase-9/appendices/FORENSIC-RUBRIC-P9.md");
  const mdoc = await readRepoFile("docs/audits/phase-9-zero-debt-forensic-audit.mdoc");
  if (!rubric.includes("minimum_score: 8") && !rubric.includes("minimum_score: 8.0")) {
    return { ok: false, detail: "FORENSIC-RUBRIC-P9 missing minimum_score" };
  }
  if (!mdoc.includes("FORENSIC-RUBRIC-P9") && !mdoc.includes("REQ-P9-083")) {
    return { ok: false, detail: "forensic mdoc not linked to rubric" };
  }
  return { ok: true, detail: null };
}

/**
 * @returns {Promise<{ ok: boolean; detail: string | null }>}
 */
export async function verifySmokeFixtureSot() {
  const rel = "apps/api/test/fixtures/operator-smoke-e2e-tenant.ts";
  try {
    const raw = await readRepoFile(rel);
    if (!raw.includes("OPERATOR_SMOKE") || !raw.includes("SMK-P9-SEED")) {
      return { ok: false, detail: `${rel} incomplete fixture contract` };
    }
  } catch {
    return { ok: false, detail: `missing ${rel}` };
  }
  const smoke = await readRepoFile("docs/phase-9/appendices/SMOKE-SCENARIO-MAP.md");
  if (!smoke.includes("operator-smoke-e2e-tenant.ts")) {
    return { ok: false, detail: "SMOKE-SCENARIO-MAP missing fixture module ref" };
  }
  return { ok: true, detail: null };
}

/**
 * @returns {Promise<{ ok: boolean; detail: string | null }>}
 */
export async function verifyE2eWiring() {
  const config = "apps/web/playwright.operator.config.ts";
  try {
    await fs.access(path.join(REPO_ROOT, config));
  } catch {
    return { ok: false, detail: `missing ${config}` };
  }
  const pkg = await readRepoFile("apps/web/package.json");
  if (!pkg.includes('"test:e2e:operator"')) {
    return { ok: false, detail: "apps/web/package.json missing test:e2e:operator" };
  }
  const sessionFixture = "apps/web/test/fixtures/operator-owner-session.ts";
  try {
    await fs.access(path.join(REPO_ROOT, sessionFixture));
  } catch {
    return { ok: false, detail: `missing ${sessionFixture}` };
  }
  return { ok: true, detail: null };
}

/**
 * @returns {Promise<{ ok: boolean; detail: string | null }>}
 */
export async function verifyAdversarialMatrix() {
  const rel = "docs/phase-9/appendices/ADVERSARIAL-MATRIX-P9.md";
  const raw = await readRepoFile(rel);
  for (const id of ["ADV-P9-01", "ADV-P9-05", "ADV-P9-10"]) {
    if (!raw.includes(id)) {
      return { ok: false, detail: `ADVERSARIAL-MATRIX-P9 missing ${id}` };
    }
  }
  const rubric = await readRepoFile("docs/phase-9/appendices/FORENSIC-RUBRIC-P9.md");
  if (!rubric.includes("ADV-P9")) {
    return { ok: false, detail: "FORENSIC-RUBRIC-P9 missing ADV-P9 cross-ref" };
  }
  return { ok: true, detail: null };
}

/**
 * @returns {Promise<{ ok: boolean; detail: string | null }>}
 */
export async function verifyIdentitySchemaRegistry() {
  const dispatch = await readRepoFile("docs/phase-9/appendices/identity-api-dispatch-addendum.md");
  if (!dispatch.includes("2026-06-08-v2")) {
    return { ok: false, detail: "identity-api-dispatch-addendum not v2" };
  }
  for (const schema of [
    "IDENTITY-OTP-REQUEST.schema.json",
    "IDENTITY-OTP-VERIFY.schema.json",
    "IDENTITY-SESSION-RESPONSE.schema.json",
    "IDENTITY-ABILITY-CONTEXT.schema.json",
  ]) {
    if (
      !dispatch.includes(schema.replace(".schema.json", "")) &&
      schema !== "IDENTITY-ABILITY-CONTEXT.schema.json"
    ) {
      /* ability schema referenced in dispatch body text */
    }
    try {
      await fs.access(path.join(REPO_ROOT, `docs/phase-9/appendices/schemas/${schema}`));
    } catch {
      return { ok: false, detail: `missing schema ${schema}` };
    }
  }
  return { ok: true, detail: null };
}

/**
 * P8 — AGENT-NAVIGATOR decision tree depth.
 * @returns {Promise<{ ok: boolean; detail: string | null }>}
 */
export async function verifyNavigatorPresent() {
  const nav = await readRepoFile("docs/phase-9/AGENT-NAVIGATOR.md");
  if (!nav.includes("Decision tree")) {
    return { ok: false, detail: "AGENT-NAVIGATOR missing decision tree" };
  }
  const nodes = (nav.match(/^  ├─|^  └─/gm) || []).length;
  if (nodes < 8) {
    return { ok: false, detail: `AGENT-NAVIGATOR only ${nodes} decision nodes (need ≥8)` };
  }
  return { ok: true, detail: null };
}

/**
 * P8 — DEC-P9-015 actor column drift (Leader as RBAC role).
 * @returns {Promise<{ ok: boolean; detail: string | null }>}
 */
export async function verifyLeaderActorDrift() {
  const route = await readRepoFile("docs/phase-9/appendices/ADMIN-ROUTE-MATRIX.md");
  if (/\|\s*Leader\s*\|/.test(route) || /Admin\/Owner\/Leader/.test(route)) {
    return { ok: false, detail: "Leader RBAC drift in ADMIN-ROUTE-MATRIX" };
  }
  const router = await readRepoFile("docs/phase-9/phase-9-agent-router.md");
  if (/Leader opens/.test(router)) {
    return { ok: false, detail: "Leader opens drift in phase-9-agent-router" };
  }
  return { ok: true, detail: null };
}

/**
 * P8 — DEC-P9-017 interim + target finance paths documented.
 * @returns {Promise<{ ok: boolean; detail: string | null }>}
 */
export async function verifyFinancePathDual() {
  const router = await readRepoFile("docs/phase-9/phase-9-agent-router.md");
  if (!router.includes("app/finance") || !router.includes("DEC-P9-017")) {
    return { ok: false, detail: "router missing finance interim path or DEC-P9-017" };
  }
  const boundary = await readRepoFile("docs/phase-9/appendices/PHASE-BOUNDARY-MATRIX.md");
  if (!boundary.includes("apps/web/app/finance/**")) {
    return { ok: false, detail: "PHASE-BOUNDARY-MATRIX missing interim finance path" };
  }
  return { ok: true, detail: null };
}

/**
 * P8 — AGENT-CURRENT-PHASE.yaml synced to IMPLEMENTATION-TRUTH.
 * @returns {Promise<{ ok: boolean; detail: string | null }>}
 */
export async function verifyCurrentPhaseSnapshot() {
  const snap = await readRepoFile("docs/phase-9/appendices/AGENT-CURRENT-PHASE.yaml");
  if (!snap.includes("doc_ready_subphase:")) {
    return { ok: false, detail: "AGENT-CURRENT-PHASE missing doc_ready_subphase" };
  }
  const truth = await readRepoFile("docs/phase-9/audits/IMPLEMENTATION-TRUTH.md");
  const truthMatch = truth.match(/doc_ready_subphase:\s*"([^"]+)"/);
  const snapMatch = snap.match(/doc_ready_subphase:\s*"([^"]+)"/);
  if (truthMatch && snapMatch && truthMatch[1] !== snapMatch[1]) {
    return {
      ok: false,
      detail: `AGENT-CURRENT-PHASE doc_ready ${snapMatch[1]} != truth ${truthMatch[1]}`,
    };
  }
  return { ok: true, detail: null };
}

/**
 * P8 — TEMP scaffold manifest ↔ SPEC-REGISTRY scaffold_policy.
 * @returns {Promise<{ ok: boolean; detail: string | null }>}
 */
export async function verifyScaffoldManifest() {
  const readme = await readRepoFile("TEMP/phase9-wip-specs/README.md");
  if (!readme.includes("T-9.1")) {
    return { ok: false, detail: "TEMP/phase9-wip-specs/README.md missing T-9.1" };
  }
  const registry = await readRepoFile("docs/phase-9/appendices/SPEC-REGISTRY-OPERATOR.yaml");
  if (!registry.includes("scaffold_policy:")) {
    return { ok: false, detail: "SPEC-REGISTRY-OPERATOR missing scaffold_policy" };
  }
  return { ok: true, detail: null };
}
