# Phase 8 — پلن ارتقا به نمره ۹۵+ (doc-only · post-audit)

```yaml
plan_version: "2026-06-08-v1"
supersedes_partially: TEMP/phase8-doc-97-roadmap.md
baseline_after_blocks_A_E:
  guard: "14/14 PASS — pnpm run phase-8:guard"
  audit_score_overall: 88
  audit_score_8_1: 91
  audit_score_consistency: 72
  audit_score_guard_behavioral: 45
target:
  overall_min: 95
  subphase_8_1_min: 97
scope: "doc + guard + spec scaffold alignment — بدون apps/api/src/urban/** تا تأیید Architect"
truth_ledger: docs/phase-8/audits/IMPLEMENTATION-TRUTH.md
```

> **تفاوت با roadmap قبلی:** بلوک‌های A–E ساختار PEK/envelope/naming را بستند. **این پلن** شکاف‌های **attestation drift**، **prove_with fragmentation**، **API surface mismatch** و **guard theater** را هدف می‌گیرد — همان چیزهایی که نمره consistency را زیر ۷۵ نگه می‌دارند.

---

## مدل نمره‌دهی (وزن‌دار)

| بعد | وزن | الان (audit) | هدف ۹۵+ |
| --- | --- | ------------ | -------- |
| PEK / traceability | 20% | 92 | ≥ 95 |
| consistency داخلی doc | 25% | 72 | ≥ 95 |
| guard integrity (نه behavioral trunk) | 20% | 55 | ≥ 90 |
| agent-readiness 8.1 | 20% | 58 | ≥ 95 |
| honesty ledger | 15% | 80 | ≥ 98 |

**فرمول تقریبی:** `overall ≈ 0.20×PEK + 0.25×consistency + 0.20×guard + 0.20×agent + 0.15×honesty`

برای **۹۵ overall** با PEK≈92: باید consistency و agent-readiness هر دو **≥ 93** شوند.

---

## «الان کجاییم؟» (post A–E · post-audit)

| لایه | ✅ | ❌ / ⚠️ |
| ---- | -- | ------- |
| Guard structural | 14/14 PASS | attestation در truth هنوز **9/9** |
| PEK | 32 فایل | — |
| Envelope DEC-P8-003 | doc + guard | spec ASM-001 metadata ناقص |
| prove_with | 4 مسیر در 8.1 subphase | guard اجبار **6** spec — 2 spec orphan |
| Subphase model | — | READY vs active_subphase=8.0 |
| Spec compile | — | import phantom trunk |
| Entry 8.0 | — | `phase-8-entry-verified.yaml` absent |

---

## Sprint 2 — J + K + L `[x]`

| فاز | وضعیت |
| --- | ----- |
| J contract depth | `[x]` — ASM-001 metadata · `p8_envelope_spec_depth` · env inject rows · 8.1 tour gate · 8.2 lazy-urban extend |
| K boot/subphase model | `[x]` — `READY_FOR_IMPLEMENTATION` · `implementation_mode` · ERIP doc_ready |
| L entry honesty | `[x]` — `reports/phase-8-entry-verified.yaml` · `p8_entry_ledger_present` |

**Gate:** `19/19 PASS` · PEK **33** · truth **19/19**

---

## Sprint 1 — F + G + H `[x]`

| فاز | وضعیت |
| --- | ----- |
| F attestation integrity | `[x]` — `p8_truth_attestation_sync` |
| G prove_with unification | `[x]` — `SPEC-REGISTRY-8.1.yaml` · `p8_prove_with_parity` |
| H API surface alignment | `[x]` — DEC-P8-004 · SDK spec · router · `p8_api_surface_alignment` |

**Gate:** `17/17 PASS` · PEK **33** · truth **17/17** فازها

```text
F (attestation) ──> G (prove_with) ──> H (API surface)
                         │                    │
                         v                    v
                    I (guard compile)    J (contract depth)
                         │                    │
                         └────────┬───────────┘
                                  v
                            K (boot/subphase)
                                  │
                                  v
                            L (entry honesty)
                                  │
                                  v
                            M (charter deferred)  [اختیاری 97+]
```

**موازی‌سازی مجاز:** H ∥ J (بعد از G) · K بعد از F

---

## فاز F — Attestation integrity (+۴ consistency · +۲ honesty)

**هدف نمره:** overall **90** · consistency **82**

| # | کار | فایل(ها) | معیار پذیرش |
| - | --- | -------- | ----------- |
| F1 | حذف **9/9** و **10 gates** stale | `IMPLEMENTATION-TRUTH.md` L28 · `phase-8-guards.md` L191–215 | `rg '9/9|charter_gates: 9|charter_gates: 10' docs/phase-8` → **0** |
| F2 | example JSON guard → 14 check IDs | `phase-8-guards.md` report shape | JSON example lists `p8_hardening_artifacts` … `p8_casl_no_ellipsis` |
| F3 | truth attestation row → `14/14` + `charter_gates: 14` | `IMPLEMENTATION-TRUTH.md` · `verification-matrix.md` rollup | هم‌خوان با `reports/phase-8-gate-*.json` |
| F4 | guard `p8_truth_attestation_sync` | `phase-8-hardening-artifacts.mjs` یا `phase-8-guard-lib.mjs` | FAIL if truth mentions gate count ≠ runner `charter_gates` |

**تأیید:**

```bash
pnpm run phase-8:guard   # 15/15 if F4 added
rg '9/9|charter_gates: (9|10|11|12|13)[^0-9]' docs/phase-8
```

**تخمین:** +4 overall → **92**

---

## فاز G — prove_with unification (+۵ agent · +۳ consistency)

**هدف نمره:** overall **93** · agent-readiness **88**

| # | کار | فایل(ها) | معیار پذیرش |
| - | --- | -------- | ----------- |
| G1 | `SPEC-REGISTRY-8.1.yaml` — **single source** 6 paths | `appendices/SPEC-REGISTRY-8.1.yaml` (جدید) | `contract_id` + 6 paths = guard registry |
| G2 | sync BOOT-MANIFEST 8.1 prove_with | `BOOT-MANIFEST.yaml` L73–76 | 6 paths · شامل `urban-owner-ability` API |
| G3 | sync 8.1 subphase + truth `prove_with_implementation` | `8.1-single-owner-auth.md` · `IMPLEMENTATION-TRUTH.md` | identical ordered list |
| G4 | sync verification-matrix §8.1 bundle | `verification-matrix.md` L117–123 | 6 commands |
| G5 | sync TRACEABILITY test column | `TRACEABILITY-MATRIX-8.1.md` | redis-fallback + tours-bypass cited |
| G6 | guard `p8_prove_with_parity` | hardening lib | reads SPEC-REGISTRY vs BOOT + 8.1 yaml front-matter |

**۶ spec canonical (normative):**

1. `packages/workspace-sdk/test/urban-owner-ability.spec.ts`
2. `apps/api/test/urban-owner-ability.spec.ts`
3. `apps/api/test/urban-settings-patch.spec.ts`
4. `apps/api/test/urban-redis-fallback.spec.ts`
5. `apps/api/test/urban-tours-bypass-gate.spec.ts`
6. `apps/web/test/urban-owner-access.spec.ts`

**تخمین:** +3 overall → **95** (آستانه اول)

---

## فاز H — API surface alignment (+۴ agent · +۳ consistency)

**هدف نمره:** 8.1 **95** · consistency **90**

| # | کار | فایل(ها) | معیار پذیرش |
| - | --- | -------- | ----------- |
| H1 | SDK spec → **method form** `authz.canPerformUrbanOwnerMutation(...)` | `packages/workspace-sdk/test/urban-owner-ability.spec.ts` | no standalone import of `canPerformUrbanOwnerMutation` |
| H2 | `isWorkspaceOwner` export → **tenant-auth-grants.ts** only | SDK spec import path · CASL · 8.1 §3 | spec imports from `tenant-auth-grants.js` |
| H3 | router allowlist: **حذف** `wizard-access*.ts` از 8.1 | `phase-8-agent-router.md` L82 | only `urban-settings-access.ts` |
| H4 | `assertUrbanOwner` → `assertWorkspaceOwner` | `verification-matrix.md` P8-F-003 | `rg assertUrbanOwner docs/phase-8` → 0 |
| H5 | DEC-P8-004 (جدید): TenantAuthz method-only · no free function | `IMPLEMENTATION-DECISIONS.md` | guard cites DEC |
| H6 | CANLOAD dual-source law: web re-exports contract | `CANLOAD-URBAN-SETTINGS.contract.ts` header + 8.1 deliverable table | one authority path documented |

**تخمین:** 8.1 → **95** · overall **96**

---

## فاز I — Guard compile honesty (+۵ guard · +۲ agent)

**هدف:** guard score **85+** · جلوگیری از «سبز ولی compile قرمز»

| # | کار | فایل(ها) | معیار پذیرش |
| - | --- | -------- | ----------- |
| I1 | `p8_spec_import_policy` — دو حالت صریح | truth + guard | **SCAFFOLD_MODE=import-stubs** یا **IMPL_MODE=resolve-trunk** |
| I2a | (doc-only path) spec imports فقط از `docs/phase-8/appendices/*.contract.ts` تا trunk | 3 spec files | `pnpm exec tsc --noEmit -p packages/workspace-sdk` روی spec **optional** |
| I2b | (preferred doc) `SCAFFOLD-IMPORT-MATRIX.yaml` — allowed import roots per spec | appendices | guard validates imports ⊆ matrix |
| I3 | guard `p8_spec_import_boundary` | hardening lib | FAIL on `../src/urban/` import when `apps/api/src/urban` absent **unless** IMPL_MODE |
| I4 | truth row: `spec_compile_status: SCAFFOLD_UNRESOLVED` | IMPLEMENTATION-TRUTH | honesty explicit |

**سیاست پیشنهادی (Architect):** تا trunk، specs از **contract stubs در docs** import کنند؛ web/api specs فعلاً `CANLOAD` contract + type-only mocks — **نه** `../src/urban/*`.

**تخمین:** overall **96–97** · guard integrity **88**

---

## فاز J — Contract depth (+۳ consistency · +۲ 8.1)

**هدف:** DEC-P8-003 fully enforced doc+spec

| # | کار | فایل(ها) | معیار پذیرش |
| - | --- | -------- | ----------- |
| J1 | ASM-001 assert `metadata.correlationId` · `primaryColor` · `featureFlags` · `rateLimitRps` | `urban-settings-patch.spec.ts` | keys present (nullable OK per envelope) |
| J2 | guard `p8_envelope_spec_depth` | hardening lib | regex/AST check in patch spec |
| J3 | `URBAN_TEST_INJECT_*` env rows | `env-runtime-matrix.md` | all inject vars from API specs listed |
| J4 | 8.1 out-of-scope §1: **tour publish-field gate** explicitly in-scope | `8.1-single-owner-auth.md` L41 | resolves boundary vs TPG spec |
| J5 | 8.2 lazy-urban: **«extend 7.3»** not «New» | `8.2-urban-features.md` L51 | aligned with truth 7.3 VERIFIED |

**تخمین:** 8.1 → **97** · overall **97**

---

## فاز K — Boot / subphase model (+۳ agent · +۲ honesty)

**هدف:** یک پاسخ به «الان 8.0 یا 8.1؟»

| # | کار | فایل(ها) | معیار پذیرش |
| - | --- | -------- | ----------- |
| K1 | `repo_status_enum` + `READY_FOR_IMPLEMENTATION` | `BOOT-MANIFEST.yaml` | enum includes status |
| K2 | `detect_current_subphase` rule: doc-ready 8.1 vs behavioral 8.1 | BOOT + guard-lib | algorithm documented |
| K3 | truth `implementation_mode` block | IMPLEMENTATION-TRUTH | `doc_ready_subphase: 8.1` · `behavioral_subphase: 8.0` · `blockers: [TG-P8-001, BL-P8-01]` |
| K4 | ERIP row: COP mandatory when `doc_ready_subphase >= 8.1` | guard-lib ERIP check | optional split from active_subphase |
| K5 | subphase 8.1 yaml `repo_status` → `READY_FOR_IMPLEMENTATION` | `8.1-single-owner-auth.md` | matches truth |

**تخمین:** agent-readiness **95+**

---

## فاز L — Entry gate honesty (+۲ honesty · +۱ overall)

**هدف:** TG-P8-001 دیگر hollow نباشد

| # | کار | فایل(ها) | معیار پذیرش |
| - | --- | -------- | ----------- |
| L1 | scaffold `reports/phase-8-entry-verified.yaml` | reports/ | fields per 8.0-entry.md · `phase_7_gate.status: PENDING` until real run |
| L2 | truth BL-P8-01 explicit: entry yaml exists but phase-7 not PASS | IMPLEMENTATION-TRUTH | no false VERIFIED_ENTRY |
| L3 | guard `p8_entry_ledger_present` | phase-8-guard | file exists + required keys (status may be PENDING) |

**تخمین:** honesty **98** · overall **97–98**

---

## فاز M — Charter deferred (اختیاری · 97+ → 99 doc)

**فقط اگر Architect بخواهد guard را به «charter کامل» نزدیک کند**

| # | check ID | کار کوتاه |
| - | -------- | --------- |
| M1 | `p8_owner_auth_specs` | CASL route rows ↔ spec case IDs |
| M2 | `p8_urban_routes_bound` | ROUTE-MATRIX paths ⊆ dispatch addendum |
| M3 | `p8_smoke_map_present` | SMK-P8-01..04 each has command in verification-matrix |
| M4 | `p8_verification_matrix_hydrated` | every REQ-P8-010..012 has file anchor |
| M5 | `PHASE-BOUNDARY` CI hook doc | `.github` or `scripts/guards/p8-boundary-diff.mjs` |

**تخمین:** guard integrity **95+** · overall doc cap **99** (بدون trunk behavioral)

---

## جدول پیش‌بینی نمره (cumulativ)

| پس از فاز | overall | 8.1 | consistency | guard | agent |
| --------- | ------- | --- | ----------- | ----- | ----- |
| A–E (الان) | 88 | 91 | 72 | 55 | 58 |
| +F | 92 | 92 | 82 | 58 | 60 |
| +G | **95** | 94 | 88 | 62 | 88 |
| +H | 96 | **95** | 90 | 65 | 93 |
| +I | 97 | 96 | 91 | **88** | 94 |
| +J | **97–98** | **97** | 93 | 90 | 95 |
| +K | 98 | 97 | 94 | 90 | **96** |
| +L | **98** | 97 | 95 | 90 | 96 |
| +M (opt) | **99** | 98 | 96 | **95** | 97 |

**حداقل برای «بالای ۹۵»:** تکمیل **F + G** (اجباری) · **H** (strongly recommended).

---

## ترتیب اجرا برای ایجنت (Sprint plan)

### Sprint 1 — عبور از ۹۵ (۱–۲ سession · doc-only)

1. F1–F4 (attestation)
2. G1–G6 (prove_with)
3. H1–H4 (API surface quick wins)

**Exit:** `pnpm run phase-8:guard` ≥15/15 · `rg '9/9' docs/phase-8` → 0 · SPEC-REGISTRY synced

### Sprint 2 — ۹۷ doc (۱ session) `[x]`

4. J1–J5 (contract depth) `[x]`
5. K1–K5 (boot model) `[x]`
6. L1–L3 (entry scaffold) `[x]`

**Exit:** ASM-001 full metadata asserts · entry yaml on disk · truth blockers explicit · **19/19 guard**

### Sprint 3 — 99 doc charter (optional) `[x]`

7. M1–M5 (charter deferred) `[x]`

**Exit:** **24/24 guard** · smoke index · boundary CI hook · CASL↔spec parity

---

## چک‌لیست Definition of Done — نمره ۹۵+

```bash
# Structural
pnpm run phase-8:guard                    # ≥15/15 (post F4+G6)

# Attestation
rg '9/9|charter_gates: (9|10)\b' docs/phase-8     # 0
jq .charter_gates reports/phase-8-gate-*.json      # == truth citation

# Registry parity
diff <(yq '.specs[]' docs/phase-8/appendices/SPEC-REGISTRY-8.1.yaml | sort) \
     <(node -e "import('./scripts/guards/lib/phase-8-hardening-artifacts.mjs').then(m=>console.log(m.REQUIRED_PHASE8_8_1_SPEC_REGISTRY.join('\n')))" | sort)

# API surface
rg 'assertUrbanOwner|wizard-access\*\.ts.*8\.1' docs/phase-8   # 0
rg 'canPerformUrbanOwnerMutation\(authz,' packages/workspace-sdk/test/urban-owner-ability.spec.ts  # method via authz only

# Honesty
test -f reports/phase-8-entry-verified.yaml
rg 'READY_FOR_IMPLEMENTATION' docs/phase-8/appendices/BOOT-MANIFEST.yaml
```

---

## خارج از scope این پلن (نمره 99+ behavioral)

| کار | نمره اضافه | gate |
| --- | ---------- | ---- |
| پیاده‌سازی `apps/api/src/urban/**` | +behavioral | specs exit 0 |
| SDK `canPerformUrbanOwnerMutation` | +behavioral | SDK spec exit 0 |
| `pnpm run phase-8:gate` green | +closure | 8.5 DoD |

**قانون:** doc ۹۵+ ≠ Product Parity DoD. truth باید `behavioral: SPEC_ONLY` بماند تا specs سبز شوند.

---

## ریسک‌ها

| ریسک | mitigation |
| ---- | ---------- |
| F4/G6 guard proliferation | merge into `phase-8-hardening-artifacts.mjs` · charter_gates cap doc in guards.md |
| Spec refactor (I) breaks scaffold | SCAFFOLD_MODE explicit in truth قبل از تغییر import |
| phase-7:gate heavy | entry yaml `PENDING` — honesty not false PASS |
| Architect rejects DEC-P8-004 | H5 optional — H1–H4 sufficient for 95 |

---

## ارجاع

- Audit: conversation 2026-06-08 (critical review)
- Completed: `TEMP/phase8-doc-97-roadmap.md` blocks A–E
- Truth: `docs/phase-8/audits/IMPLEMENTATION-TRUTH.md`
- Guards: `docs/phase-8/phase-8-guards.md`
