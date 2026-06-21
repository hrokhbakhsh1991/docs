# P4-B — Portal Registration · Nano-Task Spec (AI Lite v2)

```yaml
doc_id: P4-B-PORTAL-REGISTRATION
version: 1.0-aligned
file_map: TEMP/p4/FILE-MAP.md
agent_entry: TEMP/p4/AGENT-START.md
nano_tasks: 14
parent_tasks: 7
start: P4-B-N-001
stop: P4-B-N-014
epic: P4-B
status: complete
execute_after: P4-A-N-012
doc_first: docs/phase-17/platform-portal-registration.mdoc
doc_status: complete
quality_target: 9.9+/10
```

> **Doc SoT:** [platform-portal-registration.mdoc](../../docs/phase-17/platform-portal-registration.mdoc)

## §Facts frozen (2026-06-21)

| #   | Fact                              | Evidence                                               |
| --- | --------------------------------- | ------------------------------------------------------ |
| F1  | Portal registration flow exists   | `public-catalog-registration-flow.tsx`                 |
| F2  | M17 guard 30/30                   | `guard-public-catalog-m17.mjs`                         |
| F3  | Marketing URL resolver unit specs | `resolve-web-registration-url.spec.ts` (MKT-07…MKT-11) |
| F4  | Portal base URL specs             | `resolve-portal-base-url.spec.ts` (PTL-01…PTL-02)      |
| F5  | Web redirect specs                | `portal-registration-redirect.spec.ts` (PTL-03)        |
| F6  | Public auth contract stable       | `public-auth.routes.ts`                                |
| F7  | Portal BFF registrations route    | `apps/portal/app/api/catalog/registrations/route.ts`   |

## Parent task map

| Parent                            | Nano                    |
| --------------------------------- | ----------------------- |
| P4-B-T-001 M17 baseline audit     | N-001                   |
| P4-B-T-002 Marketing URL resolver | N-002 N-003             |
| P4-B-T-003 Portal host resolution | N-004 N-005             |
| P4-B-T-004 Web redirect bridge    | N-006                   |
| P4-B-T-005 Env + doc matrix       | N-007 N-008             |
| P4-B-T-006 API contract parity    | N-009 N-010             |
| P4-B-T-007 EPIC gate              | N-011 N-012 N-013 N-014 |

## Assertion ID map (doc ↔ tests)

| Doc ID | Test ID       | Spec file                         |
| ------ | ------------- | --------------------------------- |
| BR-01  | MKT-07        | supportsCatalogRegistration       |
| BR-02  | MKT-08…MKT-10 | resolvePortalPublicBaseUrl + path |
| BR-03  | MKT-11        | PORTAL_PUBLIC_BASE_URL override   |
| PR-01  | PTL-01        | portal base from shop host        |
| PR-02  | PTL-02        | marketing back-link               |
| PR-03  | SMK-PTL-01    | Playwright portal smoke           |
| PR-04  | SMK-MKT-03    | marketing CTA href                |
| PR-05  | PTL-03        | web redirect URL                  |

---

## NANO TASKS

### P4-B-N-001 [AUDIT] P4-B-T-001 — M17 guard green

**DO THIS**

1. Run `pnpm run guard:public-catalog-m17` — must exit 0 (30/30).
2. Record result in `FILE-MAP.md` § P4-B baseline.

**VERIFY**

```bash
pnpm run guard:public-catalog-m17
```

**STOP** if any M17 check fails — fix doc or code before portal work.

**NEXT:** N-002

---

### P4-B-N-002 [TEST] P4-B-T-002 — marketing URL resolver (BR-01…BR-03)

**DO THIS**

1. Run `apps/marketing/test/resolve-web-registration-url.spec.ts`.
2. Map doc IDs BR-01…BR-03 to existing MKT-07…MKT-11 assertions (no rename unless guard breaks).

**VERIFY**

| ID    | Assert                                                  |
| ----- | ------------------------------------------------------- |
| BR-01 | urban + denali support registration; starter false      |
| BR-02 | shop host → portal base + `/catalog/{id}/register` path |
| BR-03 | `PORTAL_PUBLIC_BASE_URL` overrides dev host             |

```bash
pnpm --filter @apps/marketing exec node --import tsx --test test/resolve-web-registration-url.spec.ts
```

**NEXT:** N-003

---

### P4-B-N-003 [AUDIT] P4-B-T-002 — marketing CTA wiring

**DO THIS**

1. Confirm tour detail page uses `resolveWebRegistrationUrl` and `data-marketing-register`.
2. No CTA pointing at `apps/web` admin host for registration.

**VERIFY** — grep `data-marketing-register` in `apps/marketing`.

**STOP** if CTA href uses web admin origin.

**NEXT:** N-004

---

### P4-B-N-004 [TEST] P4-B-T-003 — portal base URL (PR-01…PR-02)

**DO THIS**

Run `apps/portal/test/resolve-portal-base-url.spec.ts`.

**VERIFY**

| ID    | Assert                                           |
| ----- | ------------------------------------------------ |
| PR-01 | `shop.{club}` → `http://{club}:3003`             |
| PR-02 | portal back-link → `shop.{club}:3002/tours/{id}` |

```bash
pnpm --filter @apps/portal exec node --import tsx --test test/resolve-portal-base-url.spec.ts
```

**NEXT:** N-005

---

### P4-B-N-005 [TEST] P4-B-T-003 — Playwright SMK-PTL-01 (PR-03)

**DO THIS**

Run portal registration smoke (Architect YES for full Playwright in CI).

**VERIFY**

| ID    | Assert                                 |
| ----- | -------------------------------------- |
| PR-03 | OTP intake → profile → party → success |

```bash
pnpm --filter @apps/portal test:e2e -- portal-registration-smoke.spec.ts
```

**STOP** if duplicate registration UI exists in `apps/web` (redirect only).

**NEXT:** N-006

---

### P4-B-N-006 [TEST] P4-B-T-004 — web redirect (PR-05)

**DO THIS**

Run `apps/web/test/portal-registration-redirect.spec.ts`.

**VERIFY**

| ID    | Assert                                     |
| ----- | ------------------------------------------ |
| PR-05 | web host → portal `/catalog/{id}/register` |

```bash
pnpm --filter @apps/web exec node --import tsx --test test/portal-registration-redirect.spec.ts
```

**NEXT:** N-007

---

### P4-B-N-007 [DOC] P4-B-T-005 — env matrix in mdoc

**DO THIS**

1. Ensure `platform-portal-registration.mdoc` documents:
   - `PORTAL_PUBLIC_BASE_URL`
   - `PORTAL_DEV_PORT` (default 3003)
   - `MARKETING_PUBLIC_BASE_URL` (web redirect source)
2. Add prod vs dev matrix table if missing.

**VERIFY** — mdoc frontmatter `quality: 9.9`.

**NEXT:** N-008

---

### P4-B-N-008 [IMPLEMENT] P4-B-T-005 — fix CTA regression if any

**DO THIS**

Only if N-003 or PR-04 fails: patch marketing detail CTA to portal URL.

**VERIFY** — re-run N-002 + marketing smoke PR-04.

**STOP** if fix requires editing `packages/workspaces/denali`.

**NEXT:** N-009

---

### P4-B-N-009 [TEST] P4-B-T-006 — public-auth contract unchanged

**DO THIS**

Run existing public-auth specs (if present) or snapshot route handlers.

**VERIFY** — no breaking change to OTP request/verify paths used by portal.

**NEXT:** N-010

---

### P4-B-N-010 [TEST] P4-B-T-006 — portal BFF registrations route

**DO THIS**

1. Unit or integration test for `POST /api/catalog/registrations` BFF proxy.
2. Assert tenant header + tourId forwarded to API public auth.

**VERIFY** — 4xx on missing tour; 2xx shape on happy path mock.

**NEXT:** N-011

---

### P4-B-N-011 [DOC] P4-B-T-006 — phase-11 cross-ref

**DO THIS**

1. Link `11.16-user-portal.md` ↔ `platform-portal-registration.mdoc`.
2. Update `public-catalog.md` § Registration with P4-B doc pointer.

**VERIFY** — bidirectional reference in both files.

**NEXT:** N-012

---

### P4-B-N-012 [VERIFY] P4-B-T-007 — marketing + portal unit green

**DO THIS**

```bash
pnpm --filter @apps/marketing test
pnpm --filter @apps/portal test
```

**VERIFY** — exit 0.

**NEXT:** N-013

---

### P4-B-N-013 [TEST] P4-B-T-007 — M17 in p4:gate

**DO THIS**

Confirm `scripts/p4-club-product-gate.sh` includes `guard:public-catalog-m17`.

**VERIFY** — grep gate script; run partial gate through M17 step.

**NEXT:** N-014

---

### P4-B-N-014 [TEST] P4-B-T-007 — EPIC gate

**DO THIS**

All P4-B specs + smokes green · denali diff empty (covenant).

**VERIFY**

```bash
pnpm run guard:public-catalog-m17
pnpm --filter @apps/marketing exec node --import tsx --test test/resolve-web-registration-url.spec.ts
pnpm --filter @apps/portal exec node --import tsx --test test/resolve-portal-base-url.spec.ts
pnpm --filter @apps/web exec node --import tsx --test test/portal-registration-redirect.spec.ts
git diff --quiet packages/workspaces/denali
```

**NEXT:** P4-C-N-001
