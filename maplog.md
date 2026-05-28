
## 48. Phase 1 Hardening Audit Report

**Audit date:** 2026-05-28  
**Scope:** Discipline and logic gates (commitlint, Zod UX, Socket.dev, test-pairing).

| Gate | Status | Evidence |
|------|--------|----------|
| **Commitlint (Husky `commit-msg`)** | **FAIL** (spec mismatch) / **PASS** (behavior) | `.husky/commit-msg` exists and runs commitlint with zero-bypass guards. Hook uses `pnpm exec commitlint --edit "$1"`, **not** the audited pattern `npx --no -- commitlint --edit ${1}`. Live check: `git commit --allow-empty -m "test"` → `husky - commit-msg script failed (code 1)` (`type-empty`, `subject-empty`). Direct hook run on message `test` → exit `1`. |
| **Zod `zod-validation-error` in `denaliSubmitValidation.ts`** | **FAIL** | Package not in root or `apps/web` `package.json` / lockfile. `denaliSubmitValidation.ts` throws raw `z.ZodError` from `safeParse` with no `fromZodError` / `zod-validation-error` integration. |
| **Socket.dev integration** | **PASS** (config + CI) / **PARTIAL** (local hook) | `socket.yml` (v2), devDep `socket`, `scripts/socket-ci-check.sh`, `pnpm run audit:socket`, wired in `scripts/ci-integrity-check.sh` and `.github/workflows/integrity-gate.yml` (`SOCKET_SECURITY_API_TOKEN`). No dedicated Husky pre-push/pre-commit hook; local scan skips without token (exit `0`). |
| **Test-pairing (`guardrails:test-pairing` + pre-commit)** | **PASS** | Root script `pnpm run guardrails:test-pairing` → exit `1` when subjects lack specs (full-tree audit active). `lint-staged` runs `precommit-test-pairing-staged.mjs` on every commit. Simulated newly added `features/.../__audit_phase1_subject.ts` → pre-commit exit `1` with co-located test requirement. ESLint `test-pairing/require-test-pair` also enabled in `.eslintrc.cjs`. **Note:** full-repo audit reports many legacy missing pairs (baseline debt); gate blocks **new** additions without specs. |

### Recommended follow-ups

1. Align `.husky/commit-msg` with `npx --no -- commitlint --edit ${1}` if strict parity with the Phase 1 spec is required (current `pnpm exec` is equivalent when pnpm is available).
2. Add `zod-validation-error` to `apps/web` and map `ZodError` → user-facing issues in `denaliSubmitValidation.ts` (and callers).
3. Add `SOCKET_SECURITY_API_TOKEN` to GitHub secrets so `integrity-gate` runs a real `socket ci` scan (optional: Husky `pre-push` for developers with token).
4. Burn down or exempt legacy test-pairing gaps so `guardrails:test-pairing` passes on a clean tree.


## 49. Phase 1 Violation Inventory

**Scan date:** 2026-05-28  
**Commands:** `pnpm eslint . --max-warnings 0 --format json` → `logs/phase1-violations.json` (cleaned via direct `eslint` binary; pnpm engine WARN redirected to `logs/phase1-eslint-stderr.txt`); `pnpm exec commitlint --from HEAD~1 --to HEAD`; `pnpm run depcruise`; `pnpm run guardrails:test-pairing`; `apps/web` `tsc --noEmit` + `pnpm run build`.

### Full-scan summary

| Gate | Result | Count / notes |
|------|--------|----------------|
| **ESLint (repo)** | **FAIL** | 268 errors, 3 warnings across 2109 files (`logs/phase1-violations.json`). Exit `1`. Top rules: `@typescript-eslint/no-non-null-assertion` (115), `no-empty` (42), `@typescript-eslint/no-extraneous-class` (38). |
| **ESLint (`wizard/denali`)** | **FAIL** | 43 errors in 18 files under `apps/web/src/features/tours/wizard/denali/**`. |
| **Commitlint (HEAD)** | **PASS** | `pnpm exec commitlint --from HEAD~1 --to HEAD` → exit `0`. Last commit: `9d7585c` — `chore: pin toolchain versions and add CI integrity gate`. (`npx commitlint` without `pnpm exec` misparses `--from` under npm.) |
| **Depcruise** | **FAIL** | 2 circular dependency errors (exit `2`). Denali-adjacent: `drafts/denali-adapter.ts` ↔ `drafts/sanitizeDenaliWizardDraftSnapshot.ts`. |
| **Test-pairing (`denali`)** | **FAIL** (baseline) | 67 subject files under `wizard/denali/` missing co-located specs; pre-commit still blocks **new** additions. |
| **`apps/web` build** | **PASS** | `pnpm run build` completed (Next.js). Production bundle not blocked by current Denali TS issues in non-staged paths. |
| **`apps/web` tsc** | **FAIL** | Multiple errors; Denali-related include `denaliRuleAccess.spec.ts` unused imports, `denaliCanonicalFormAdapter.spec.ts` type mismatch, smoke/e2e Denali tests. Pre-commit `tsc-staged` fails when those files are staged. |
| **Zod `zod-validation-error`** | **FAIL** (Phase 1) | Still absent from `denaliSubmitValidation.ts` (see §48). |

### Top 5 Denali Wizard logic blockers (build / commit)

1. **`denaliRuleAccess.spec.ts` — ESLint + TSC on staged changes** — 12× `@typescript-eslint/no-unused-vars` from truncated/merged spec tail; fails `eslint` and `precommit-tsc-staged` when this file is in the commit.
2. **Test-pairing gate on new Denali sources** — 67 existing `wizard/denali/**` subjects lack `.spec.ts`; any **new** file under `features/` (e.g. `DenaliCanonicalContext.tsx`, components, hooks) without a co-located test is rejected by `precommit-test-pairing-staged.mjs` (exit `1`).
3. **Depcruise cycle — draft Denali adapter** — `denali-adapter.ts` ↔ `sanitizeDenaliWizardDraftSnapshot.ts` violates `no-circular-dependencies`; fails `depcruise` in lint-staged when either file is staged.
4. **`denaliCanonicalFormAdapter.ts` — ESLint `no-explicit-any` (8)** — Core form↔canonical bridge; blocks commits that touch this file until typed or rule-suppressed intentionally.
5. **Phase 1 Zod submit UX gap — `denaliSubmitValidation.ts`** — No `zod-validation-error`; submit path throws raw `ZodError` only. Does not fail build today but fails Phase 1 hardening intent and hinders consistent wizard error surfacing.

### Artifact paths

- `logs/phase1-violations.json` — ESLint JSON (2109 file results)
- `logs/phase1-eslint-stderr.txt` — pnpm engine warning stderr

