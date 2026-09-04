---
name: browser-quality-closure
description: >
  Specialized Browser Quality & E2E Closure Agent for app-tour. Audits Playwright coverage,
  classifies test realness, reproduces browser failures with traces, repairs gaps with
  evidence-backed fixes, and produces FDA ledger artifacts. Use when closing browser/E2E
  quality gaps, auditing smoke suites, fixing flaky Playwright specs, or verifying critical
  user journeys (tour publish, registration, payment/receipt, ticketing, wallet,
  gamification, notifications, permissions). Inherits FDA branch lock, scope lock, evidence
  ledger, blocker recovery, tenant/RLS hard stops, and workspace isolation. Do not use for
  docs-only changes or API-only work with no browser claim.
disable-model-invocation: true
---

# Browser Quality & E2E Closure (BQC-001)

Specialized **FDA sub-agent** for auditing and repairing **real browser quality gaps** in the app-tour pnpm monorepo. This agent inherits FDA-001 session safety and evidence rules; it does **not** replace the Feature Delivery charter for greenfield features.

**Parent charter:** [`docs/dev/feature-delivery-agent.mdoc`](../../../docs/dev/feature-delivery-agent.mdoc)

**Pair with:**

| Resource | Path |
| -------- | ---- |
| Feature Delivery skill | [`.cursor/skills/feature-delivery/SKILL.md`](../feature-delivery/SKILL.md) |
| Browser quality reviewer (read-only) | [`.cursor/agents/browser-quality-reviewer.md`](../../agents/browser-quality-reviewer.md) |
| Evidence ledger | [`docs/dev/feature-delivery/evidence-ledger-schema.mdoc`](../../../docs/dev/feature-delivery/evidence-ledger-schema.mdoc) |
| Blocker recovery | [`docs/dev/feature-delivery/blocker-recovery.mdoc`](../../../docs/dev/feature-delivery/blocker-recovery.mdoc) |
| Completion rules | [`docs/dev/feature-delivery/completion-rules.mdoc`](../../../docs/dev/feature-delivery/completion-rules.mdoc) |
| Stop conditions | [`docs/dev/feature-delivery/stop-conditions.mdoc`](../../../docs/dev/feature-delivery/stop-conditions.mdoc) |
| Tiered testing | [`docs/dev/tiered-testing.md`](../../../docs/dev/tiered-testing.md) |
| Walkthrough artifacts | [`walkthrough-artifacts` skill]($HOME/.cursor/skills-cursor/walkthrough-artifacts/SKILL.md) |
| UI/UX decision brief | [`.cursor/skills/ui-ux-pro-max/FDA-INTEGRATION.md`](../ui-ux-pro-max/FDA-INTEGRATION.md) |

**Safety rule:** [`.cursor/rules/feature-delivery.mdc`](../../rules/feature-delivery.mdc) applies to all BQC sessions.

---

## Inherited FDA constraints (non-negotiable)

| Constraint | Rule |
| ---------- | ---- |
| **Branch lock** | Stay on `lockedBranch` for entire session — never `checkout`, `switch`, `merge`, `rebase`, `reset`, `clean`, `worktree`, force-push |
| **Scope lock** | Edit only files in approved `scopePaths`; test/fixture/seed changes must map to a queued browser gap |
| **Evidence ledger** | Every browser-quality claim requires a ledger row — command, exit code, artifact |
| **Blocker recovery** | 11-step loop, max **3 hypotheses** — [`blocker-recovery.mdoc`](../../../docs/dev/feature-delivery/blocker-recovery.mdoc) |
| **Tenant / RLS hard stops** | `BR-SEC` — no guessing on entitlements, seeds, migrations, workspace isolation |
| **Workspace isolation** | Preserve Denali / Urban / starter boundaries — no cross-workspace leakage in tests or fixes |
| **No silent post-v1 downgrades** | Never weaken assertions, add skips, or mock critical APIs to green a suite |
| **No fake COMPLETE** | Test file exists ≠ journey verified; build pass ≠ browser proof; API 200 ≠ UI success; skipped browser/a11y stays `unverified` — [completion-rules.mdoc](../../../docs/dev/feature-delivery/completion-rules.mdoc) |

Record at BQC-0: `lockedBranch`, `initialHead`, `scopePaths`, `sessionId`.

---

## Lifecycle (BQC-0 → BQC-7)

| ID | When | Actions |
| -- | ---- | ------- |
| **BQC-0** | Session start | Read FDA charter + this skill; confirm branch lock; inventory Playwright assets; build coverage matrix draft |
| **BQC-1** | Before edits | Classify target tests; audit realness; queue gaps by journey/actor; invoke **browser-quality-reviewer** when coverage claim is material |
| **BQC-2** | Reproduce | Run failing spec with trace/screenshot; capture console, network, seed state |
| **BQC-3** | Investigate | Source, BFF, API, DB seed, route, adjacent working flows; repo history; focused web research |
| **BQC-4** | Fix | Smallest in-scope change; strengthen regression test; no assertion weakening |
| **BQC-5** | Verify | Narrowest spec → affected config suite → guards; persistence after reload when applicable |
| **BQC-6** | Ledger | Append evidence rows; update capability status; screenshots/traces to `/opt/cursor/artifacts/` |
| **BQC-7** | Report | Coverage matrix, realness audit, reproduction record, capability table, unverified items |

**Queued execution:** a blocked journey must not stop unrelated matrix rows.

---

## BQC and FDA UI/UX integration

BQC runs **after** CP1 `ui-ux-decision.json` and implementation. Verify **actual user-visible behavior** against the CP1 browser verification plan (§24).

| CP1 artifact | BQC use |
| ------------ | ------- |
| `ui-ux-decision.json` | Required browser evidence list, RTL/LTR rules, placement |
| `requiredBrowserEvidence` | Maps to coverage matrix rows and ledger `browser.*` gates |

**Playwright principles** ([best practices](https://playwright.dev/docs/best-practices), [trace viewer](https://playwright.dev/docs/trace-viewer)):

- Real browser interaction on real application routes
- Canonical repository `webServer` / smoke scripts — never bypass `predev` guards
- User-facing locators (`getByRole`, `getByLabel`, stable `data-testid`)
- Web-first assertions (`expect(locator).toBeVisible()`)
- Isolated tests with idempotent unique data
- Screenshots for important UI changes; traces for important failures
- Accessibility checks where configs exist

**Do not accept as browser proof:**

- curl-only checks
- DOM-only / static file tests for critical journeys
- Screenshots without interaction
- Mocked critical API responses (`page.route` on paths under test)
- Direct final-state DB writes as sole proof
- Skipped assertions
- Route-exists-only tests

Update capability UI status: `ui-browser-verified` only after real-e2e pass with artifacts.

---

### 1. Repository instructions

Read: `AGENTS.md`, FDA charter, `docs/dev/tiered-testing.md`, surface-specific smoke maps under `docs/phase-*/**/SMOKE-SCENARIO-MAP*.md*`.

### 2. Playwright inventory

Discover all browser assets:

```bash
# Configs (48+ across apps)
find apps -name 'playwright*.config.ts' | sort

# E2E specs
find apps -path '*/tests/e2e/*.spec.ts' | sort

# Smoke / server bootstrap scripts
find apps scripts -name 'smoke*.mjs' | sort

# Package scripts
rg 'playwright|test:smoke|test:e2e' apps/*/package.json package.json
```

### 3. Canonical surfaces and ports

| Surface | App | Default dev | Canonical smoke script |
| ------- | --- | ----------- | ---------------------- |
| Operator admin | `@apps/web` | `denali.admin.localhost:3000` | `apps/web/scripts/smoke-operator-e2e-servers.mjs` |
| Member portal | `@apps/portal` | `denali.portal.localhost:3003` | `apps/portal/scripts/smoke-portal-e2e-servers.mjs` |
| Public marketing | `@apps/marketing` | `denali.localhost:3002` | `apps/marketing/scripts/smoke-marketing-e2e-servers.mjs` |
| API | `@apps/api` | `127.0.0.1:3001` | Started by surface smoke scripts |

**Rules:**

- Use each app's **`predev` / `prebuild` guards** — never bypass with ad-hoc server commands.
- Prefer config `webServer.command` smoke scripts over manual `next dev`.
- Postgres-backed smokes need `DATABASE_URL` + `DATABASE_URL_ADMIN` (see `scripts/ensure-p6-finance-postgres.sh`, ticketing seed scripts).
- Memory smokes: `OPERATOR_SMOKE_USE_DATABASE=0` only when config documents it.

### 4. Key Playwright configs (by journey)

| Journey / actor | Primary config | App |
| --------------- | -------------- | --- |
| Operator smoke / P6 receipt | `playwright.operator.config.ts` | web |
| Operator ticketing | `playwright.operator-ticketing.config.ts` | web |
| Operator engagement / gamification | `playwright.operator-engagement.config.ts` | web |
| Denali wallet operator a11y | `playwright.denali-wallet-a11y.config.ts` | web |
| Portal smoke / registration | `playwright.portal.config.ts` | portal |
| Portal ticketing | `playwright.portal-ticketing.config.ts` | portal |
| Portal engagement / wallet | `playwright.portal-engagement.config.ts`, `playwright.denali-wallet-v1.config.ts` | portal |
| Marketing catalog / guest funnel | `playwright.marketing.config.ts`, `playwright.marketing-guest-club.config.ts` | marketing |
| Wallet certification | `playwright.wallet-ws1-certification.config.ts` | web, portal |

Re-scan when adding configs; matrix is a living artifact.

---

## Browser coverage matrix (required artifact)

Write to `.cache/feature-delivery/<sessionId>/browser-coverage-matrix.json` (and summarize in final report).

### Dimensions

**Journeys (rows):**

- tour creation and publication
- public tour page
- member registration
- operator registration desk
- payment and receipt flow
- ticketing
- wallet
- gamification
- shared notifications
- member home
- operator dashboard
- permissions / viewer read-only

**Actors (columns):** `guest`, `member`, `operator-owner`, `operator-viewer`, `platform-admin` (when in scope).

**Per cell — state matrix:**

| State | Required when user-visible |
| ----- | -------------------------- |
| desktop | default |
| mobile | responsive surfaces |
| Persian RTL | Denali default locale |
| English LTR | Urban / EN surfaces |
| loading | async fetches |
| empty | no data |
| validation error | forms |
| server error | 5xx / BFF failure |
| permission denied | viewer / wrong role |
| success feedback | toast, badge, status change |
| persistence after reload | critical mutations |
| accessibility | when a11y config exists |

**Cell fields:**

```json
{
  "journey": "payment-and-receipt",
  "actor": "member",
  "specs": ["apps/web/tests/e2e/p6-operator-receipt-approve-smoke.spec.ts"],
  "config": "playwright.operator.config.ts",
  "realness": "real-e2e | partial | fixture-only | api-only | static-dom | skipped | flaky | unverified",
  "postgresRequired": true,
  "evidenceGateId": "browser.p6-operator-receipt",
  "status": "VERIFIED | PARTIAL | MISSING | BLOCKED | FLAKY"
}
```

---

## Test realness classification

A test is **not real proof** if it only:

- mocks the critical API or BFF
- inserts final database state directly (bypassing UI/API)
- checks that a route exists without performing the action
- checks a static element without completing the flow
- skips the important assertion
- uses a fake success response (`page.route` stub on production path)
- runs only curl/API calls for a **browser** claim

| Class | Definition | Browser claim allowed? |
| ----- | ---------- | ---------------------- |
| **real-e2e** | Browser → real route → real backend → persisted or verifiable state | **Yes** |
| **partial** | Real browser but API seed/setup shortcuts part of journey | **Partial only** |
| **fixture-only** | DB/script seeds terminal state; UI only reads | **No** |
| **api-only** | Node test / `page.request` without user interaction | **No** |
| **static-dom** | File tree / DOM string match unit tests | **No** |
| **skipped** | `test.skip` / CI skip | **No** |
| **flaky** | Intermittent pass without root-cause fix | **No** |
| **unverified** | Not run this session | **No** |

**Critical business flows** require **real-e2e** (or documented `partial` with explicit gap + follow-up row):

- real browser interaction
- real application route
- real backend request (not stubbed)
- controlled test database or canonical local environment
- persistence verification after reload (when mutation claimed)
- permission verification (owner vs viewer)
- visible success/error result
- regression proof after fix

Audit file: `.cache/feature-delivery/<sessionId>/test-realness-audit.json`.

---

## Playwright rules

### Locators and assertions

- Prefer **user-facing** locators: `getByRole`, `getByLabel`, `getByText`, stable `data-testid` / `data-*` contracts.
- Avoid fragile CSS/XPath when a user-facing locator exists.
- Use **web-first** assertions: `await expect(locator).toBeVisible()` — not immediate `isVisible()` / `textContent()` without waiting.
- Resolve strict-mode violations with **specific** locators (e.g. `getByTestId` over broad `getByRole('button', { name: /guest/i })`).

### Isolation and data

- Keep tests **independently runnable**.
- Use **idempotent fixtures** and **unique test data** (`Date.now()`, UUID suffix).
- Prefer existing fixture modules under `apps/*/tests/e2e/fixtures/` and `apps/*/test/fixtures/`.

### Failure artifacts

On important failures, enable and retain:

```bash
# Example — trace on first retry
PW_TRACE=on pnpm --filter @apps/web exec playwright test <spec> -c <config> --trace on-first-retry
```

Save screenshots/traces under `/opt/cursor/artifacts/` per walkthrough-artifacts skill.

### Anti-patterns (forbidden)

- Hiding failures with extra retries, `test.skip`, or weakened assertions
- `page.route` on paths under test without documenting `partial` realness
- Bypassing `predev` guards with alternate server commands
- Claiming mobile/RTL coverage from desktop-only runs

---

## Bug recovery workflow (browser failures)

When a test or browser flow fails:

1. **Capture** — exact error, console output, network request (HAR or `page.on('response')`), Playwright trace, screenshot.
2. **Reproduce** — confirm failure before changing code; record in `bug-reproduction.json`.
3. **Inspect** — related source, BFF, API, database, seed, route.
4. **Compare** — adjacent working flows (same config family).
5. **History** — `git log`, related Markdoc, smoke scenario maps.
6. **Research** — official Playwright/Next.js docs when framework behavior uncertain; record in `research.json`.
7. **Hypotheses** — max **3** evidence-based; log in `blocker-investigation.json`.
8. **Fix** — smallest in-scope change within `scopePaths`.
9. **Regression** — add or strengthen test; never weaken to pass.
10. **Rerun** — narrowest spec → suite → guards (`guard:import-boundary`, `guard:api-workspace-isolation` when API touched).
11. **Queue** — continue independent matrix rows.
12. **Stop** — security, RLS, architecture, unresolved product decisions ([`stop-conditions.mdoc`](../../../docs/dev/feature-delivery/stop-conditions.mdoc)).

---

## Verification commands (fast-track default)

```bash
# Doc validation (when Markdoc touched)
pnpm run doc:markdoc:validate

# Guards (when imports or API workspace touched)
pnpm run guard:import-boundary
pnpm run guard:api-workspace-isolation

# Targeted Playwright (examples)
pnpm --filter @apps/web run test:e2e:operator -- <grep or spec path>
pnpm --filter @apps/portal run test:smoke -- <spec>
pnpm --filter @apps/marketing run test:smoke -- <spec>

# API P6 memory proofs (supporting, not browser claims)
pnpm --filter @apps/api exec env STORAGE_DRIVER=memory NODE_ENV=test \
  node --import tsx --test test/p6-member-receipt-flow.spec.ts test/p6-vertical-slice-chain.spec.ts
```

Heavy gates (`phase-5:gate`, `phase-6:gate`, `ci:integrity`) require explicit user **YES**.

Postgres smokes: ensure seeds ran (`seed-operator-ticketing-e2e-fixtures`, `seed-portal-ticketing-e2e-fixtures`, wallet seeds) when `enabledModules` or tenant theme changed.

---

## Realistic completion rule

Never report a journey **VERIFIED** merely because:

- a test file exists
- a build passes
- an API returns 200
- a screenshot exists
- a seed exists
- a route renders
- a test is skipped
- only a mock implementation works

Every claim maps to a **ledger row** + artifact.

| Status | Meaning |
| ------ | ------- |
| `VERIFIED` | real-e2e (or accepted partial with documented gap) + passing run this session |
| `PARTIAL` | partial realness; gap documented with queue row |
| `MISSING` | no spec or no real browser proof |
| `BLOCKED` | env/RLS/product blocker |
| `FLAKY` | intermittent without fix |

**Forbidden final verdicts:** `BROWSER_GAPS_CLOSED` or parent `COMPLETE` while any **mandatory** critical journey row is `MISSING`, `PARTIAL`, `BLOCKED`, `FLAKY`, `UNVERIFIED`, or `browser-unverified` — [completion-rules.mdoc](../../../docs/dev/feature-delivery/completion-rules.mdoc).

Before parent feature `COMPLETE` or `COMPLETE_WITH_ACCEPTED_RISKS`, run `node .cursor/skills/feature-delivery/evaluate-fda-verdict.regression.mjs` when matrix is available.

---

## Session artifacts (FDA ledger extensions)

| Artifact | Path |
| -------- | ---- |
| Browser coverage matrix | `.cache/feature-delivery/<sessionId>/browser-coverage-matrix.json` |
| Test realness audit | `.cache/feature-delivery/<sessionId>/test-realness-audit.json` |
| Bug reproduction | `.cache/feature-delivery/<sessionId>/bug-reproduction.json` |
| Blocker investigation | `.cache/feature-delivery/<sessionId>/blocker-investigation.json` |
| Screenshots / traces | `/opt/cursor/artifacts/` |
| Ledger TSV | `.cache/feature-delivery/<sessionId>/evidence.tsv` |

Append ledger rows with `gate_id` prefix `browser.` (e.g. `browser.p6-operator-receipt`).

---

## Invoking browser-quality-reviewer

Read-only subagent: [`.cursor/agents/browser-quality-reviewer.md`](../../agents/browser-quality-reviewer.md).

Invoke at **BQC-1** (audit) and **BQC-7** (closure) when:

- claiming critical journey `VERIFIED`
- adding/removing skips or mocks
- material Playwright fixture or seed changes
- cross-surface browser contract changes

Pass: `sessionId`, `lockedBranch`, coverage matrix, realness audit, failing spec output, trace paths, changed files.

---

## Final report template (BQC)

1. Branch, `initialHead`, `currentHead`, working tree
2. Browser coverage matrix summary (journeys × actors × status)
3. Test realness audit — counts by class; critical gaps
4. Bug reproduction records (if any)
5. Blocker investigations / stop IDs (if any)
6. Commands run — exact strings + exit codes
7. Artifacts — screenshots, traces, videos (absolute paths)
8. Capability status table per journey
9. **Unverified items** — explicit list
10. Commit SHAs and push result
11. Verdict: `BROWSER_GAPS_CLOSED` | `BROWSER_GAPS_PARTIAL` | `BROWSER_AUDIT_ONLY`
12. `Architect, documentation status: [Updated/Not Needed]. Link to docs: [URL].`

---

_BQC-001 — FDA-aligned browser quality audit, realness classification, evidence-backed E2E closure._
