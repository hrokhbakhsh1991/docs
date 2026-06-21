# P0 — Platform Foundation (Workspace Decoupling)

```yaml
phase: P0
status: complete
date_closed: 2026-06-20
next: P1
detail_spec: TEMP/p0-wizard-workspace-remediation.md
```

## مسیر در roadmap

```text
START → [P0 ✅] → P1 → P2 → P3
```

## خلاصه

جداسازی Denali از shell — UI در package · finance generic · manifest dispatch.

---

## زیرفازها (5)

| # | زیرفاز | EPIC | گام | وضعیت |
|---|--------|------|-----|--------|
| **P0-1** | Web UI decouple | A–J | 8 | ✅ |
| **P0-2** | Finance generic | K | 4 | ✅ |
| **P0-3** | API cleanup | L | 3 | ✅ |
| **P0-4** | Tests & boundary | M | 3 | ✅ |
| **P0-5** | Exit gate | N | 2 | ✅ |

**جمع گام‌ها:** 20

---

### P0-1 — Web UI decouple (8 گام)

| گام | کار | خروجی |
|-----|-----|--------|
| 1 | Surfaces → `packages/workspaces/denali/ui/surfaces/` | composite + review |
| 2 | Chrome → `ui/chrome/` | wizard · flat-edit |
| 3 | Adapters → `ui/adapters/` | no `@/` in package |
| 4 | Fields + logic → `ui/fields/` · `ui/logic/` | ~88 فایل |
| 5 | manifest `wizardSurfaces` rewire | generated bindings |
| 6 | Thin shell `apps/web` | orchestrator only |
| 7 | حذف `apps/web/src/wizard/denali/` | folder empty |
| 8 | boundary specs green | wizard-host-boundary |

### P0-2 — Finance generic (4 گام)

| گام | کار | خروجی |
|-----|-----|--------|
| 1 | `denali-finance/` → `workspace-finance/` | rename |
| 2 | outbox dispatch از manifest | generated side-effects |
| 3 | HTTP finance host generic | configure-workspace-finance |
| 4 | T-128 registrar types | typed handlers |

### P0-3 — API cleanup (3 گام)

| گام | کار | خروجی |
|-----|-----|--------|
| 1 | settings enrichers generated | no direct denali import |
| 2 | bootstrap wizard template generic | seed-workspace-wizard-template |
| 3 | HTTP routes از manifest | workspace-http-routes.generated |

### P0-4 — Tests & boundary (3 گام)

| گام | کار | خروجی |
|-----|-----|--------|
| 1 | workspace-boundary.spec | shell import guard |
| 2 | denali package path specs | T-151/153 |
| 3 | finance + dispatch specs | integration |

### P0-5 — Exit gate (2 گام)

| گام | کار | خروجی |
|-----|-----|--------|
| 1 | `generate:workspace-registry --check` | fresh |
| 2 | `test:changed` + pre-commit fast | green |

---

## Exit criteria P0

- [x] UI در `packages/workspaces/denali/src/ui/`
- [x] `workspace-finance` جایگزین denali-finance
- [x] manifest-driven dispatch
- [x] exit gate سبز

→ **بعدی:** [P1](./p1-platform-control-center.md)
