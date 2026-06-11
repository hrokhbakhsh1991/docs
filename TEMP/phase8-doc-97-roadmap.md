# Phase 8 — نقشه رسیدن به نمره ۹۷+ (اجرایی بودن doc برای ایجنت)

```yaml
created: "2026-06-07"
baseline_score:
  overall: 86
  subphase_8_1: 91
target_score:
  overall: 97
  subphase_8_1: 97
guard_baseline: "17/17 PASS — pnpm run phase-8:guard (Sprint 1 F+G+H complete)"
truth_ledger: docs/phase-8/audits/IMPLEMENTATION-TRUTH.md
sole_router: docs/phase-8/phase-8-agent-router.md
```

> **نحوه استفاده:** بلوک‌ها به ترتیب DAG. هر بلوک doc/guard/scaffold — **بدون** `apps/api/src/urban/**` تا تأیید Architect.

---

## «الان کجاییم؟»

| لایه | وضعیت | blocker |
| ---- | ------- | ------- |
| `phase-8:guard` | ✅ 17/17 (Sprint F–H) | — |
| PEK register | ✅ 32 فایل (Block F در PEK) | — |
| نام spec | ✅ `urban-settings-patch` یکسان در docs/phase-8 | — |
| Envelope GET vs PATCH | ✅ DEC-P8-003 قفل شد | — |
| `apps/api/src/urban/**` | ❌ 0 فایل | پیاده‌سازی بعد از doc |
| SDK `canPerformUrbanOwnerMutation` | ❌ نیست | پیاده‌سازی 8.1 |
| `TEMP/phase8-wip-specs/` | ⚠️ کپی موازی | بلوک C6 |

---

## بلوک A — یک حقیقت برای envelope (+۴ نمره)

| # | کار | فایل | وضعیت |
| - | --- | ---- | ----- |
| A1 | DEC-P8-003: GET=ENVELOPE · PATCH=`{ urban }` | `appendices/IMPLEMENTATION-DECISIONS.md` | `[x]` |
| A2 | `handleGetUrbanSettings` + لینک envelope | `appendices/CASL-URBAN-OWNER-SPEC.md` | `[x]` |
| A3 | HTTP RESPONSE split GET/PATCH | `appendices/URBAN-THEME-MERGE-ALGORITHM.md` | `[x]` |
| A4 | dispatch addendum: GET envelope · PATCH bare urban | `appendices/urban-api-dispatch-addendum.md` | `[x]` |
| A5 | guard `p8_envelope_consistency` | `scripts/guards/lib/phase-8-hardening-artifacts.mjs` | `[x]` |
| A6 | ASM-8.1-001 spec → `success/data/metadata` | `apps/api/test/urban-settings-patch.spec.ts` | `[x]` |

**یادداشت اجرا:** سه spec (`urban-owner-ability` · `urban-redis-fallback` · `urban-tours-bypass-gate`) از `TEMP/phase8-wip-specs/` به `apps/api/test/` بازگردانده شدند تا `p8_hardening_artifacts` سبز بماند — بلوک C6 هنوز باز است.

**تأیید:**

```bash
pnpm run phase-8:guard   # شامل p8_envelope_consistency
rg 'GET  /urban/settings 200 body := \{ urban:' docs/phase-8  # 0
rg 'DEC-P8-003' docs/phase-8/appendices/IMPLEMENTATION-DECISIONS.md
```

---

## بلوک B — PEK 32 (+۳ نمره)

| # | کار | وضعیت |
| - | --- | ----- |
| B1 | `REQUIRED_PHASE8_PEK_FILES` 23→32 | `[x]` |
| B2 | `PRECISION-DOC-INDEX.md` sync | `[x]` |
| B3 | `IMPLEMENTATION-TRUTH` Block F + gates:11 | `[x]` |
| B4 | `phase-8-guards.md` stale «9 gates» cleanup | `[x]` |

**فایل‌های PEK جدید:**

- `appendices/AGENT-STATE-MAP-8.1.yaml`
- `appendices/TRACEABILITY-MATRIX-8.1.md`
- `appendices/urban-api-dispatch-addendum.md`
- `appendices/URBAN-THEME-MERGE-ALGORITHM.md`
- `appendices/TOURS-PUBLISH-FIELD-GATE.md`
- `appendices/CANLOAD-URBAN-SETTINGS.contract.ts`
- `appendices/schemas/URBAN-THEME-JSONB.schema.json`
- `appendices/schemas/URBAN-SETTINGS-PATCH.zod.ts`
- `appendices/erip/8.1-cop-auth-isolation.md`

---

## بلوک C — هم‌نام‌سازی و anti-drift (+۳ نمره)

| # | کار | وضعیت |
| - | --- | ----- |
| C1 | تصمیم: rename spec یا global replace docs | `[x]` — نگه‌داشتن `urban-settings-patch` روی دیسک |
| C2 | `rg urban-settings-owner docs/phase-8` → 0 | `[x]` |
| C3 | `BOOT-MANIFEST.yaml` prove_with sync | `[x]` |
| C4 | guard `p8_doc_path_consistency` | `[x]` |
| C5 | `PHASE-BOUNDARY-MATRIX` flat `urban/**` | `[x]` |
| C6 | حذف/deprecate `TEMP/phase8-wip-specs/` | `[x]` |

---

## بلوک D — scaffold کامل 8.1 (+۲ نمره)

| فایل | وضعیت |
| ---- | ----- |
| `packages/workspace-sdk/test/urban-owner-ability.spec.ts` | `[x]` |
| `apps/web/test/urban-owner-access.spec.ts` | `[x]` |
| guard: 6 spec paths در `p8_spec_path_registry` | `[x]` |

---

## بلوک E — CASL بدون ellipsis (+۱ نمره)

| # | کار | وضعیت |
| - | --- | ----- |
| E1 | حذف `// … existing methods …` در CASL | `[x]` |
| E2 | guard prose ellipsis در CASL | `[x]` |

---

## DAG

```text
A (envelope) ──┬──> C (naming)
B (PEK 32)   ──┘
C ──> guard 13+
D ──> guard spec registry
E ──> guard CASL
```

---

## پیش‌بینی نمره

| مرحله | 8.1 | کل فاز ۸ |
| ----- | --- | -------- |
| الان (post A) | 93 | 88 |
| بعد B+C+E | 95 | 90 |
| A+B+C+E | 95 | 90 |
| +D | **97** | **92** |
| +کد trunk سبز | 99 | 96+ |

---

## چک‌لیست نهایی ۹۷+

```bash
pnpm run phase-8:guard                    # 14/14
rg 'urban-settings-owner' docs/phase-8      # 0
rg 'existing methods' docs/phase-8/appendices/CASL-URBAN-OWNER-SPEC.md  # 0
rg 'GET.*\{ urban:' docs/phase-8/appendices/CASL-URBAN-OWNER-SPEC.md  # 0
test -f packages/workspace-sdk/test/urban-owner-ability.spec.ts
test -f apps/web/test/urban-owner-access.spec.ts
```
