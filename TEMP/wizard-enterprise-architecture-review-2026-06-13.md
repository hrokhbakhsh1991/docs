# بررسی معماری Enterprise — ویزارد Denali

تاریخ: ۱۳ ژوئن ۲۰۲۶

## اصول غیرقابل نقض

- قوانین در `packages/workspaces/denali`؛ host generic (بدون `pluginId === "denali"`).
- binding پیش‌نویس 11.5: `meta.currentStepIndex` + `wizardSessionId`.
- template gate = catalog ∩ template ∩ rule matrix.

## فیکس‌های سازگار

- `denaliCanonicalPaths.ts`, `resolve-initial-step-index.ts`, `denali-wizard-draft-merge.ts`
- `workspace-wizard-host.tsx` (controlled step skip)
- `canonical-value-text.ts` (Persian digits)

## SMK-P9-ITIN-02

گیر روی basic→photos (نه photos→program). اول deploy/sync، بعد fixture fail-fast.

## فیکس‌های اعمال‌شده (این جلسه)

1. **Template PUT** — `program.shortDescription` از steps حذف شد (وابسته composite زیر `program.themeIds`).
2. **`buildDenaliTenantWizardTemplatePayload`** — بدون step `review` / `publishStatus` برای API.
3. **`denali-program-content-field`** — textarea برای short/long description.
4. **Validation** — `expandStepFieldsForCompositeDependents` در `denali-wizard-validation.ts`.
5. **E2E fixture** — assert template PUT، fail-fast روی validation، timeout 300s.

## مانع باقی‌مانده

- deploy وب (`pnpm build` روی `/opt/app-tour`) به خاطر خطاهای TypeScript دیگر fail می‌شود؛ UI جدید composite روی :13000 هنوز live نیست.
- SMK-P9-ITIN-02 گاهی به program می‌رسد، گاهی wizard load / sync طولانی.
