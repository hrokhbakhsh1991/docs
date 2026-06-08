#!/usr/bin/env node
/**
 * Phase 9 PEK file presence + anti-hollow scanner.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../../..");

export const REQUIRED_PHASE9_PEK_FILES = [
  "docs/phase-9/phase-9-charter.md",
  "docs/phase-9/phase-9-agent-router.md",
  "docs/phase-9/phase-9-guards.md",
  "docs/phase-9/README.md",
  "docs/phase-9/audits/IMPLEMENTATION-TRUTH.md",
  "docs/phase-9/audits/verification-matrix.md",
  "docs/phase-9/appendices/BOOT-MANIFEST.yaml",
  "docs/phase-9/appendices/IMPLEMENTATION-DECISIONS.md",
  "docs/phase-9/appendices/PRECISION-DOC-INDEX.md",
  "docs/phase-9/appendices/action-registry.md",
  "docs/phase-9/appendices/ADMIN-ROUTE-MATRIX.md",
  "docs/phase-9/appendices/IDENTITY-PORT-SCOPE.md",
  "docs/phase-9/appendices/OPERATOR-LOGIN-FLOW.md",
  "docs/phase-9/appendices/identity-web-bff-addendum.md",
  "docs/phase-9/appendices/OPERATOR-PRODUCT-SCOPE.md",
  "docs/phase-9/appendices/LEGACY-ADMIN-REFERENCE.md",
  "docs/phase-9/appendices/SMOKE-SCENARIO-MAP.md",
  "docs/phase-9/appendices/env-runtime-matrix.md",
  "docs/phase-9/appendices/CASL-OPERATOR-SPEC.md",
  "docs/phase-9/appendices/TRACEABILITY-MATRIX-9.1.md",
  "docs/phase-9/appendices/TRACEABILITY-MATRIX-9.5.md",
  "docs/phase-9/appendices/TRACEABILITY-MATRIX-9.6.md",
  "docs/phase-9/AGENT-NAVIGATOR.md",
  "docs/phase-9/appendices/AGENT-CURRENT-PHASE.yaml",
  "docs/phase-9/appendices/AGENT-STATE-MAP-9.0.yaml",
  "docs/phase-9/appendices/AGENT-STATE-MAP-9.8.yaml",
  "docs/phase-9/appendices/AGENT-STATE-MAP-9.1.yaml",
  "docs/phase-9/appendices/SPEC-REGISTRY-9.1.yaml",
  "docs/phase-9/appendices/identity-api-dispatch-addendum.md",
  "docs/phase-9/appendices/CANLOAD-OPERATOR-SESSION.contract.ts",
  "docs/phase-9/appendices/schemas/IDENTITY-HTTP-ENVELOPE.yaml",
  "docs/phase-9/appendices/FORENSIC-RUBRIC-P9.md",
  "docs/phase-9/appendices/schemas/IDENTITY-OTP-REQUEST.schema.json",
  "docs/audits/phase-9-zero-debt-forensic-audit.mdoc",
  "docs/phase-9/appendices/PHASE-BOUNDARY-MATRIX.md",
  "docs/phase-9/appendices/TRACEABILITY-MAP.md",
  "docs/phase-9/appendices/SPEC-REGISTRY-OPERATOR.yaml",
  "docs/phase-9/appendices/tours-operator-api-dispatch-addendum.md",
  "docs/phase-9/appendices/users-api-dispatch-addendum.md",
  "docs/phase-9/appendices/bookings-api-dispatch-addendum.md",
  "docs/phase-9/appendices/BOOKINGS-OPS-UX.md",
  "docs/phase-9/appendices/ADMIN-SHELL-UX.md",
  "docs/phase-9/appendices/TRACEABILITY-MATRIX-9.2.md",
  "docs/phase-9/appendices/TOURS-LIST-UX.md",
  "docs/phase-9/appendices/TRACEABILITY-MATRIX-9.3.md",
  "docs/phase-9/appendices/USERS-DIRECTORY-UX.md",
  "docs/phase-9/appendices/TRACEABILITY-MATRIX-9.4.md",
  "docs/phase-9/appendices/TRACEABILITY-MATRIX-9.5.md",
  "docs/phase-9/appendices/AGENT-STATE-MAP-9.2.md",
  "docs/phase-9/appendices/ADVERSARIAL-MATRIX-P9.md",
  "docs/phase-9/appendices/settings-api-dispatch-addendum.md",
  "docs/phase-9/appendices/SETTINGS-MODULE-REGISTRY.md",
  "docs/phase-9/appendices/SETTINGS-RISK-REGISTER-P9.md",
  "docs/phase-9/appendices/AGENT-STATE-MAP-9.6.md",
  "docs/phase-9/appendices/finance-api-dispatch-addendum.md",
  "docs/phase-9/appendices/FINANCE-OPS-UX.md",
  "docs/phase-9/appendices/TRACEABILITY-MATRIX-9.7.md",
  "docs/phase-9/appendices/FINANCE-RISK-REGISTER-P9.md",
  "docs/phase-9/appendices/AGENT-STATE-MAP-9.4.md",
  "docs/phase-9/appendices/AGENT-STATE-MAP-9.5.md",
  "docs/phase-9/appendices/schemas/IDENTITY-OTP-VERIFY.schema.json",
  "docs/phase-9/appendices/schemas/IDENTITY-SESSION-RESPONSE.schema.json",
  "docs/phase-9/appendices/schemas/TOURS-LIST-PROJECTION.schema.json",
  "docs/phase-9/appendices/schemas/USERS-DIRECTORY-ROW.schema.json",
  "docs/phase-9/appendices/schemas/FINANCE-SUMMARY.schema.json",
  "docs/phase-9/appendices/schemas/PAYMENT-SCHEDULE-ITEM.schema.json",
  "docs/phase-9/appendices/AGENT-STATE-MAP-9.7.md",
  "docs/phase-9/appendices/erip/9.2-cop-admin-shell.md",
  "docs/phase-9/appendices/erip/9.3-cop-tours-operator.md",
  "docs/phase-9/appendices/erip/9.4-cop-users-rbac.md",
  "docs/phase-9/appendices/erip/9.5-cop-bookings-ops.md",
  "docs/phase-9/appendices/erip/9.6-cop-settings-templates.md",
  "docs/phase-9/appendices/erip/9.7-cop-finance-denali.md",
  "docs/phase-9/appendices/erip/9.8-cop-operator-dod.md",
  "docs/phase-9/appendices/erip/9.1-cop-identity-port.md",
  "docs/phase-9/subphases/9.0-entry.md",
  "docs/phase-9/subphases/9.1-identity-session.md",
  "docs/phase-9/subphases/9.2-admin-shell.md",
  "docs/phase-9/subphases/9.3-tours-operator.md",
  "docs/phase-9/subphases/9.4-users-rbac.md",
  "docs/phase-9/subphases/9.5-bookings-ops.md",
  "docs/phase-9/subphases/9.6-settings-templates.md",
  "docs/phase-9/subphases/9.7-finance-denali.md",
  "docs/phase-9/subphases/9.8-operator-dod-gate.md",
];

const HOLLOW_PATTERNS = [/\bTODO\b/i, /\bFIXME\b/i, /\bTBD\b/i, /\bplaceholder\b/i, /insert here/i];

/**
 * @returns {{ ok: boolean, detail: string | null }}
 */
export function verifyDocHardening() {
  const missing = REQUIRED_PHASE9_PEK_FILES.filter(
    (rel) => !fs.existsSync(path.join(REPO_ROOT, rel))
  );
  if (missing.length > 0) {
    return {
      ok: false,
      detail: `FAIL P9-GUARD-p9_doc_hardening: missing ${missing.join(", ")}`,
    };
  }
  return { ok: true, detail: null };
}

/**
 * @returns {{ ok: boolean, detail: string | null }}
 */
export function verifyAntiHollow() {
  const corpusRoot = path.join(REPO_ROOT, "docs/phase-9");
  /** @param {string} dir */
  const walk = (dir) => {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        walk(p);
      } else if (/\.(md|yaml|yml)$/.test(ent.name)) {
        const raw = fs.readFileSync(p, "utf8");
        for (const pat of HOLLOW_PATTERNS) {
          if (pat.test(raw)) {
            return {
              ok: false,
              detail: `FAIL P9-GUARD-p9_anti_hollow: ${pat} in ${path.relative(REPO_ROOT, p)}`,
            };
          }
        }
      }
    }
    return null;
  };
  const hit = walk(corpusRoot);
  if (hit) return hit;
  return { ok: true, detail: null };
}
