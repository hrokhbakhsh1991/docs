# Phase 9 — پلن هموار‌سازی مسیر agent به نمره ۹۵+ (doc-only)

```yaml
plan_version: "2026-06-08-v1"
baseline_after_doc_sync:
  agent_path_score: 80          # 8.0/10 — audit 2026-06-08
  guard: "27/28 PASS — pnpm run phase-9:guard"
  known_fail: p9_spec_path_registry
  doc_pack_integration: "~96%"
target:
  agent_path_score_min: 95      # 9.5/10
  consistency_min: 95
  guard_integrity_min: 92
scope: "doc + guard alignment — بدون promote scaffolds و بدون outbox code مگر Architect YES"
sole_entry: docs/phase-9/phase-9-agent-router.md
truth_ledger: docs/phase-9/audits/IMPLEMENTATION-TRUTH.md
companion_wip: TEMP/phase9-wip-specs/
supersedes_partially: null
```

> **نحوه استفاده:** هر **فاز** یک PR doc-only مستقل. قبل از هر session پیاده‌سازی، این فایل + router + IMPLEMENTATION-TRUTH را بخوان.  
> **قانون طلایی:** agent هرگز از subphase فعلی جلو نزند مگر `transition_guards` در BOOT-MANIFEST سبز باشد.

---

## مدل نمره‌دهی (وزن‌دار · ۰–۱۰۰)

| بعد | وزن | الان | هدف ۹۵+ |
| --- | --- | ---- | -------- |
| ورودی واحد + read order | 15% | 90 | ≥ 98 |
| «الان کجاییم؟» (boot/subphase) | 20% | 65 | ≥ 95 |
| یکنواختی cross-doc (Leader · finance path · guard) | 20% | 70 | ≥ 95 |
| per-subphase build path (UX → dispatch → proof) | 15% | 85 | ≥ 95 |
| honesty ledger vs trunk | 15% | 90 | ≥ 98 |
| scaffold / prove_with navigability | 10% | 60 | ≥ 90 |
| machine-readability (YAML · state maps) | 5% | 75 | ≥ 92 |

**فرمول:** `score ≈ Σ(weight × dimension)` → baseline **80** · هدف **95+**

---

## «الان کجاییم؟» (post doc-sync · 2026-06-08)

| لایه | ✅ | ❌ / ⚠️ |
| ---- | -- | ------- |
| SOLE ENTRY (router) | ✅ | finance interim در §2.2 نیست |
| IMPLEMENTATION-TRUTH | ✅ 27/28 · 9.7 PARTIAL | `reports/phase-9-gate-*.json` stale (28/28) |
| DEC-P9-015/016/017 | ✅ locked | Leader vocabulary پراکنده در ۴+ فایل |
| TRACEABILITY 9.4/9.7 | ✅ header sync | OPERATOR-PRODUCT-SCOPE leader→9.3 drift |
| Finance R1 trunk | ✅ API + interim UI | reconciliation DEFERRED |
| Spec scaffolds | ⚠️ 17 on trunk | identity bundle فقط در `TEMP/phase9-wip-specs/` |
| AGENT-STATE-MAP | 9.1–9.7 | 9.0 · 9.8 absent |
| detect_current_subphase | prose در BOOT | `PARTIAL_R1` در enum نیست · 9.7 exception |

**نقطه شروع این پلن:** فاز **P1** (بلافاصله بعد از doc-sync merge).

---

## نقشه DAG فازها

```text
[doc-sync DONE] ──> P1 attestation ──> P2 boot model ──> P3 Leader purge
                          │                  │                  │
                          v                  v                  v
                     P4 finance path    P5 scaffold SoT    P6 state maps
                          │                  │                  │
                          └────────┬─────────┴──────────────────┘
                                   v
                            P7 agent navigator (optional)
                                   │
                                   v
                            P8 guard charter (optional 97+)
```

**موازی‌سازی مجاز:** P3 ∥ P4 (بعد از P2) · P5 بعد از P1 · P6 ∥ P7

---

## مسیر اجرای agent (normative · پس از تکمیل P1–P7)

```text
┌──────────────────────────────────────────────────────────────────────┐
│  EVERY SESSION — mandatory (≤5 min read)                              │
│  1. docs/phase-9/phase-9-agent-router.md                              │
│  2. docs/phase-9/audits/IMPLEMENTATION-TRUTH.md                       │
│  3. docs/phase-9/appendices/BOOT-MANIFEST.yaml                        │
│     → read implementation_mode + detect_current_subphase              │
│  4. TEMP/phase9-doc-95plus-roadmap.md → current phase checkbox        │
│  5. docs/phase-9/subphases/{doc_ready_subphase}.md                    │
│  6. UX authority + dispatch addendum + TRACEABILITY-MATRIX-9.{n}.md   │
│  7. prove_with from subphase yaml → verification-matrix § bundle      │
└──────────────────────────────────────────────────────────────────────┘
```

**FAIL fast:** اگر `prove_with` path absent → بخوان `TEMP/phase9-wip-specs/README` (P5) · promote PR جدا · **نه** invent spec.

---

# فاز P1 — Attestation integrity (+۵ consistency · +۳ honesty)

**هدف partial score:** **85** · guard attestation هم‌خوان در همه doc entry points

| # | کار | فایل(ها) | معیار پذیرش |
| - | --- | -------- | ----------- |
| P1-1 | README guard → **27/28** + known fail | `docs/phase-9/README.md` L20 | `rg '28/28' docs/phase-9/README.md` → 0 |
| P1-2 | report JSON sync | `reports/phase-9-gate-YYYY-MM-DD.json` | `passed: 27` · `known_fail: p9_spec_path_registry` |
| P1-3 | router SMK-P9-06 actor | `phase-9-agent-router.md` §6 | «admin session (legacy URL alias)» — نه Leader role |
| P1-4 | PRECISION index DEC count | `PRECISION-DOC-INDEX.md` | DEC-P9-017 در locked row |
| P1-5 | guard `p9_truth_honesty` note | `phase-9-guards.md` L58 | report example `{ passed: 27 }` documented |

**تأیید:**

```bash
pnpm run phase-9:guard                    # 27 PASS then fail p9_spec_path_registry
rg '28/28 PASS' docs/phase-9               # 0 (except historical changelog if any)
rg 'Leader opens' docs/phase-9/phase-9-agent-router.md  # 0
```

**PR title:** `docs(phase-9): P1 attestation sync 27/28`

---

# فاز P2 — Boot / «الان کجاییم؟» (+۱۲ agent · +۸ boot)

**هدف partial score:** **90** · agent بدون human بداند کدام subphase active است

| # | کار | فایل(ها) | معیار پذیرش |
| - | --- | -------- | ----------- |
| P2-1 | `repo_status_enum` + **`PARTIAL_R1`** | `BOOT-MANIFEST.yaml` | enum includes status · 9.7 yaml uses it |
| P2-2 | `detect_current_subphase` v2 algorithm | `BOOT-MANIFEST.yaml` | steps: (a) read truth ledger (b) highest **VERIFIED_BEHAVIORAL** or **PARTIAL_R1** (c) next = doc_ready (d) TG-P9-001 cap |
| P2-3 | `implementation_mode` block sync | `IMPLEMENTATION-TRUTH.md` | `doc_ready_subphase` · `behavioral_active_subphase` · `partial_subphases: ["9.7"]` |
| P2-4 | transition note for 9.7 | `BOOT-MANIFEST.yaml` TG-P9-005 | 9.8 blocked until 9.7 **R4 closure** or explicit waiver — not confused with R1 PARTIAL |
| P2-5 | router §1 diagram update | `phase-9-agent-router.md` | step 3 cites P2-2 algorithm by name |
| P2-6 | **`AGENT-CURRENT-PHASE.yaml`** (جدید) | `docs/phase-9/appendices/AGENT-CURRENT-PHASE.yaml` | machine snapshot: `doc_ready` · `behavioral` · `partial` · `blockers[]` · `next_prove_with[]` |

**نمونه AGENT-CURRENT-PHASE.yaml (scaffold):**

```yaml
snapshot_version: "2026-06-08"
doc_ready_subphase: "9.1"
behavioral_active_subphase: "9.0"
partial_subphases:
  - id: "9.7"
    status: PARTIAL_R1
    r1_complete: true
    r2_r4_pending: true
blockers:
  - TG-P9-001
next_read:
  - docs/phase-9/subphases/9.1-identity-session.md
  - docs/phase-9/appendices/IDENTITY-PORT-SCOPE.md
next_prove_with:
  - apps/api/test/identity-otp.spec.ts  # SCAFFOLD — see TEMP/phase9-wip-specs/
forbidden_until_blocker_clear:
  - "9.2+ implementation without phase_8_gate PASS"
```

**تأیید:**

```bash
rg 'PARTIAL_R1' docs/phase-9/appendices/BOOT-MANIFEST.yaml
test -f docs/phase-9/appendices/AGENT-CURRENT-PHASE.yaml
```

**PR title:** `docs(phase-9): P2 boot model + AGENT-CURRENT-PHASE`

---

# فاز P3 — Leader vocabulary purge (+۸ consistency · +۵ agent)

**هدف partial score:** **93** · هیچ doc actor column «Leader» به‌عنوان RBAC role نداشته باشد

**قانون doc (تکرار DEC-P9-015 — normative):**

> `leader` و `viewer` فقط **legacy hydrate aliases**. actor ∈ `{ owner, admin, member }`. `/leader/review` = **URL alias** (DEC-P9-011) · session role = `admin`.

| # | کار | فایل(ها) | معیار پذیرش |
| - | --- | -------- | ----------- |
| P3-1 | leader/review ownership → **9.5** | `OPERATOR-PRODUCT-SCOPE.md` L38 · L70 | `rg 'leader/review.*9\.3' docs/phase-9` → 0 |
| P3-2 | BOOKINGS-OPS-UX actor rows | `BOOKINGS-OPS-UX.md` §RBAC | «admin (tour ACL scope)» not «Leader (manifest scope)» |
| P3-3 | SETTINGS-RISK isLeaderRole note | `SETTINGS-RISK-REGISTER-P9.md` R-P9-S09 | cite DEC-P9-015 · no new role |
| P3-4 | TRACEABILITY SMK-P9-06 column | `TRACEABILITY-MATRIX-9.5.md` | admin session · legacy URL |
| P3-5 | guard `p9_leader_actor_drift` (optional) | `phase-9-hardening-artifacts.mjs` | FAIL on `\| Leader \|` in route matrix actor cols |
| P3-6 | glossary one-liner | `IMPLEMENTATION-DECISIONS.md` under DEC-P9-015 | cross-link all smoke/matrix docs |

**تأیید:**

```bash
rg 'Leader opens|Leader-role|Admin/Owner/Leader' docs/phase-9  # 0
rg 'leader/review.*\| 9\.3 \|' docs/phase-9/appendices/OPERATOR-PRODUCT-SCOPE.md  # 0
```

**PR title:** `docs(phase-9): P3 DEC-P9-015 actor vocabulary purge`

---

# فاز P4 — Finance path unification (+۶ consistency · +۴ agent)

**هدف:** agent همیشه بداند interim vs target (DEC-P9-017)

| # | کار | فایل(ها) | معیار پذیرش |
| - | --- | -------- | ----------- |
| P4-1 | router §2.2 interim exception | `phase-9-agent-router.md` | row: `apps/web/app/finance/**` · 9.7 · interim until 9.2 |
| P4-2 | BOOT `hot_paths.finance_interim` | `BOOT-MANIFEST.yaml` | both interim + target paths |
| P4-3 | OPERATOR-PRODUCT-SCOPE finance rows | `OPERATOR-PRODUCT-SCOPE.md` | interim path + migrate note |
| P4-4 | ADMIN-ROUTE-MATRIX web finance | `ADMIN-ROUTE-MATRIX.md` | dual row: interim + target |
| P4-5 | subphase 9.2 migration trigger | `9.2-admin-shell.md` | checklist item: move `app/finance` → `(app)/finance` |
| P4-6 | PHASE-BOUNDARY comment audit | `PHASE-BOUNDARY-MATRIX.yaml` | both paths with `interim until 9.2` comment |

**تأیید:**

```bash
rg 'app/finance' docs/phase-9/phase-9-agent-router.md
rg 'DEC-P9-017' docs/phase-9/phase-9-agent-router.md
```

**PR title:** `docs(phase-9): P4 finance interim path (DEC-P9-017) router sync`

---

# فاز P5 — Scaffold / prove_with SoT (+۱۰ scaffold · +۶ agent)

**هدف partial score:** **94** · agent وقتی spec missing است گم نشود

| # | کار | فایل(ها) | معیار پذیرش |
| - | --- | -------- | ----------- |
| P5-1 | **`TEMP/phase9-wip-specs/README.md`** | TEMP | manifest: path → promote target · priority order |
| P5-2 | truth `spec_compile_status` + promote checklist | `IMPLEMENTATION-TRUTH.md` | table: missing on trunk · copy from TEMP |
| P5-3 | SPEC-REGISTRY dual mode | `SPEC-REGISTRY-OPERATOR.yaml` | `trunk: []` · `wip_temp: []` until promote |
| P5-4 | verification-matrix honesty row | `verification-matrix.md` § Honesty | commands may fail until P5 promote PR |
| P5-5 | subphase 9.1 prove_with footnote | `9.1-identity-session.md` | `# SCAFFOLD — promote from TEMP` |
| P5-6 | promote order (normative) | this file § Promote train | 9.1 bundle first → unlock 28/28 guard |

**Promote train (ترتیب اجباری · PR جدا · Architect YES برای behavioral):**

| Train | Source (TEMP) | Target (trunk) | Unblocks |
| ----- | ------------- | -------------- | -------- |
| **T-9.1** | `api/identity-otp.spec.ts` · `identity-session.spec.ts` · `web/auth-login-*.spec.ts` · `workspace-sdk/operator-ability.spec.ts` | `apps/api/test/` · `apps/web/test/` · SDK test | `p9_spec_path_registry` → 28/28 |
| **T-9.2** | `web/admin-shell-access.spec.ts` · `dashboard-smoke.spec.ts` | `apps/web/test/` | 9.2 R1 proof |
| **T-9.4** | `api/identity-users.spec.ts` · `web/users-directory.spec.ts` | respective | 9.4 R1 |
| **T-9.5** | bookings bundle | respective | 9.5 R1 |
| **T-9.6** | settings bundle | respective | 9.6 R1 |
| **T-9.8** | `operator-smoke.spec.ts` · `phase-9.contract.spec.ts` | `apps/web/test/` | SMK-P9 |

**تأیید (post T-9.1 promote only):**

```bash
pnpm run phase-9:guard   # 28/28 PASS
```

**PR title (doc):** `docs(phase-9): P5 scaffold SoT + TEMP manifest`  
**PR title (code):** `test(phase-9): promote T-9.1 identity scaffolds` — **جدا · نیاز Architect**

---

# فاز P6 — AGENT-STATE-MAP completion (+۴ machine · +۳ agent)

| # | کار | فایل(ها) | معیار پذیرش |
| - | --- | -------- | ----------- |
| P6-1 | ASM-9.0 entry gate states | `AGENT-STATE-MAP-9.0.yaml` | TG-P9-001 blocked / unblocked |
| P6-2 | ASM-9.8 closure states | `AGENT-STATE-MAP-9.8.yaml` | phase-9:gate · SMK-P9 pass/fail |
| P6-3 | PRECISION index rows | `PRECISION-DOC-INDEX.md` | both maps listed |
| P6-4 | subphase 9.0 · 9.8 cross-links | respective subphases | link to ASM yaml |

**PR title:** `docs(phase-9): P6 state maps 9.0 + 9.8`

---

# فاز P7 — Agent navigator (optional · +۵ agent → **95+**)

**هدف:** یک فایل پاسخ به «قدم بعدی دقیقاً چیست؟»

| # | کار | فایل(ها) | معیار پذیرش |
| - | --- | -------- | ----------- |
| P7-1 | **`AGENT-NAVIGATOR.md`** | `docs/phase-9/AGENT-NAVIGATOR.md` | decision tree: IF blocker → read X · IF subphase N → file list |
| P7-2 | router pointer | `phase-9-agent-router.md` §0 | «Fast path: AGENT-NAVIGATOR.md» |
| P7-3 | README link | `docs/phase-9/README.md` | navigator in T0 table |
| P7-4 | guard `p9_navigator_present` (optional) | phase-9-guard | file exists + ≥8 decision nodes |

**نمونه decision node:**

```text
IF phase_8_gate != PASS
  → STOP at 9.0 · read subphases/9.0-entry.md · run phase-8:gate
ELIF doc_ready == 9.1 AND identity specs absent on trunk
  → read TEMP/phase9-wip-specs/README · promote T-9.1 OR doc-only work
ELIF doc_ready == 9.7 AND reconciliation pending
  → read FINANCE-OPS-UX §2.2 gap row · do NOT claim 9.7 closed
...
```

**PR title:** `docs(phase-9): P7 AGENT-NAVIGATOR decision tree`

---

# فاز P8 — Guard charter deferred (optional · 97+ doc)

| # | check | کار |
| - | ----- | --- |
| P8-1 | `p9_leader_actor_drift` | actor column scan |
| P8-2 | `p9_finance_path_dual` | interim + target in router + boundary |
| P8-3 | `p9_current_phase_snapshot` | AGENT-CURRENT-PHASE.yaml fresh vs truth |
| P8-4 | `p9_scaffold_manifest` | TEMP README paths ⊆ SPEC-REGISTRY |
| P8-5 | CI hook doc | `guard:p9-boundary-diff` in AGENTS.md |

**Exit:** charter_gates 28→32 documented · overall doc cap **97**

---

## جدول پیش‌بینی نمره (cumulative)

| پس از فاز | agent path | consistency | boot clarity | notes |
| --------- | ---------- | ----------- | ------------ | ----- |
| doc-sync (الان) | **80** | 70 | 65 | baseline |
| +P1 | 83 | 78 | 65 | attestation |
| +P2 | **88** | 82 | **92** | «الان کجاییم» |
| +P3 | 91 | **90** | 92 | Leader purge |
| +P4 | 93 | **93** | 93 | finance paths |
| +P5 (doc only) | **94** | 94 | 94 | scaffold SoT |
| +P6 | 94 | 94 | 94 | state maps |
| +P7 | **95+** | **95+** | **95+** | navigator |
| +P8 (opt) | **97** | **96** | 96 | guard depth |
| +T-9.1 promote | 95 · guard **100%** | — | — | behavioral scaffold |

**حداقل برای ۹۵:** **P1 + P2 + P3 + P4 + P7** (doc-only · ~2–3 session)

---

## Sprint plan (اجرایی)

### Sprint A — عبور از ۹۰ (۱ session · doc-only) `[x]`

1. P1 attestation (27/28 everywhere) `[x]`
2. P2 boot model + AGENT-CURRENT-PHASE.yaml `[x]`

**Exit:** `rg '28/28' docs/phase-9/README.md` → 0 · PARTIAL_R1 in BOOT enum

### Sprint B — عبور از ۹۳ (۱ session · doc-only) `[x]`

3. P3 Leader vocabulary purge `[x]`
4. P4 finance path router sync `[x]`

**Exit:** `rg 'Leader opens|9\.3.*leader/review' docs/phase-9` → 0

### Sprint C — ۹۵+ navigator (۱ session · doc-only) `[x]`

5. P5 TEMP README + truth promote checklist `[x]`
6. P7 AGENT-NAVIGATOR.md `[x]`

**Exit:** `test -f docs/phase-9/AGENT-NAVIGATOR.md` · TEMP README present

### Sprint D — guard 32/32 (code PR) `[x]`

7. T-9.1 promote from `TEMP/phase9-wip-specs/` `[x]`

**Exit:** `pnpm run phase-9:guard` → 32/32

### Sprint E — 97+ doc (optional) `[x]`

8. P6 state maps · P8 guard checks `[x]`

**Exit:** ASM-9.0 + ASM-9.8 · P8 gates in runner

---

## Definition of Done — نمره ۹۵+ (doc)

```bash
# Attestation
pnpm run phase-9:guard                    # 27/28 acceptable until Sprint D
rg '28/28' docs/phase-9/README.md         # 0

# Boot clarity
test -f docs/phase-9/appendices/AGENT-CURRENT-PHASE.yaml
rg 'PARTIAL_R1' docs/phase-9/appendices/BOOT-MANIFEST.yaml

# Consistency
rg 'Leader opens|Admin/Owner/Leader' docs/phase-9   # 0
rg 'leader/review.*9\.3' docs/phase-9/appendices/OPERATOR-PRODUCT-SCOPE.md  # 0
rg 'app/finance' docs/phase-9/phase-9-agent-router.md  # ≥1 (interim documented)

# Navigator
test -f docs/phase-9/AGENT-NAVIGATOR.md
rg 'AGENT-NAVIGATOR' docs/phase-9/phase-9-agent-router.md

# Scaffold honesty
test -f TEMP/phase9-wip-specs/README.md
rg 'SCAFFOLD.*TEMP' docs/phase-9/subphases/9.1-identity-session.md
```

---

## خارج از scope (behavioral 99 · Product DoD)

| کار | gate | owner |
| --- | ---- | ----- |
| Promote همه TEMP specs | T-9.1..T-9.8 | separate PRs |
| `apps/api/src/identity/**` implementation | 9.1 R1 | code |
| `(app)/` shell | 9.2 | blocked on 9.1 |
| Outbox workspace gate | R-P9-F13 | code PR |
| `pnpm run phase-9:gate` green | 9.8 | Architect YES only |

**قانون:** doc **95+** ≠ Operator Admin DoD. truth `behavioral: SPEC_ONLY` until prove_with exit 0.

---

## ریسک‌ها

| ریسک | mitigation |
| ---- | ---------- |
| P8 guard proliferation | cap new checks at +4 · document in phase-9-guards.md |
| Promote train breaks CI | one train per PR · `test:changed` only |
| 9.7 PARTIAL confuses TG-P9-005 | P2-4 explicit R1 vs R4 closure language |
| Agent skips IMPLEMENTATION-TRUTH | P7 navigator mandates step 2 |
| Persian/English mix | normative IDs (REQ/DEC/INV) always English |

---

## چک‌لیست پیشرفت (copy to PR body)

```markdown
- [x] P1 attestation integrity
- [x] P2 boot model + AGENT-CURRENT-PHASE.yaml
- [x] P3 Leader vocabulary purge
- [x] P4 finance path (DEC-P9-017) router sync
- [x] P5 TEMP scaffold README + truth checklist
- [x] P6 AGENT-STATE-MAP 9.0 + 9.8
- [x] P7 AGENT-NAVIGATOR.md
- [x] P8 guard charter (optional)
- [x] T-9.1 promote (code · separate PR)
```

---

## ارجاع

| Doc | Role |
| --- | ---- |
| [`docs/phase-9/phase-9-agent-router.md`](../docs/phase-9/phase-9-agent-router.md) | SOLE ENTRY |
| [`docs/phase-9/audits/IMPLEMENTATION-TRUTH.md`](../docs/phase-9/audits/IMPLEMENTATION-TRUTH.md) | honesty ledger |
| [`TEMP/phase9-wip-specs/`](../TEMP/phase9-wip-specs/) | scaffold source (P5) |
| [`TEMP/phase8-doc-95plus-plan.md`](phase8-doc-95plus-plan.md) | template for this plan |
| Audit conversation | baseline score 8.0/10 · 2026-06-08 |

---

**گام بعدی پیشنهادی:** Sprint A → **P1 + P2** در یک PR doc-only.
