# فهرست roadmap ویزارد Enterprise (TEMP)

> **آخرین به‌روزرسانی:** 2026-06-18  
> **برنچ کاری:** `wip/phase9-continuation`

## مسیر اصلی (Master roadmap)

| فایل | محتوا |
|------|--------|
| **[denali-wizard-enterprise-roadmap.md](denali-wizard-enterprise-roadmap.md)** | نقشه راه کامل Phase 0–6 · تسک‌های ریز · parity Legacy · معماری multi-workspace |


## Plugin-neutral wizard (2026-06-18)
### Phase 13 — Plugin-neutral closure (v2 granular)

| فایل | محتوا |
|------|--------|
| **[wizard-plugin-neutral-roadmap.md](wizard-plugin-neutral-roadmap.md)** | **v3 AI Playbook** — YAML tasks · preserved flows · grep gates · exact tests (~890 lines) · ۵۰+ تسک ریز · manifest dispatch · create page split |



| فایل | محتوا |
|------|--------|
| **[wizard-plugin-neutral-roadmap.md](wizard-plugin-neutral-roadmap.md)** | امتیاز 74/100 · بنچمارک صنعتی · فازبندی ۴ مرحله‌ای · P1 media contract |
| **[plugin-architecture-photo-upload-diagnostic.md](plugin-architecture-photo-upload-diagnostic.md)** | diagnostic عمیق photo upload + wizard (پیش از fix platform-core) |

## Doc رسمی Phase 12 (در حال اجرا)

| Doc | Phase |
|-----|-------|
| [docs/phase-12/README.md](../docs/phase-12/README.md) | index |
| [docs/phase-12/subphases/12.0-wizard-plugin-hooks.md](../docs/phase-12/subphases/12.0-wizard-plugin-hooks.md) | **فعال — Phase 1** |

## وضعیت اجرا

| Phase | وضعیت |
|-------|--------|
| **1 Platform decouple** | **🟢 started 2026-06-11** — SDK wizardHost hooks |
| 2–6 | ⬜ pending |

## Dev quick ref

- Wizard: `http://operator.localhost:3000/tours/new`
- OTP: `+15550001001` / `1234`

## Changelog

- **2026-06-18 (v3):** AI-friendly playbook — agent contract, NEVER DO, flow preservation, per-TASK YAML, test commands.
- **2026-06-18 (v2):** `wizard-plugin-neutral-roadmap.md` — Phase 13 subphases 13.0–13.7، تسک‌بندی ریز سازگار با `generate-workspace-registry` و Phase 12.
- **2026-06-18:** `wizard-plugin-neutral-roadmap.md` — مسیر plugin-neutral پس از حذف `denali.` از platform-core.

- **2026-06-11:** Phase 12.0b — contextual rules moved to `@app-tour/workspace-denali/wizard/contextual`; leaders filter parity (`status=active`, reward label `admin`).
