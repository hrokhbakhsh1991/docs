# P2 — Denali Safety Covenant

```yaml
doc_id: P2-DENALI-SAFETY
status: mandatory-for-all-P2-work
workspace: denali (@app-tour/workspace-denali)
rule: P2 Super Admin changes must NOT modify Denali product code
```

## یک جمله

> **Denali = محصول باشگاه.** Super Admin = لایه platform. P2 فقط platform را گسترش می‌دهد — **`packages/workspaces/denali/` دست‌نخورده** مگر باگ blocker جدا تأیید Architect.

---

## معماری (وضعیت کد امروز)

```text
admin.app-tour.ir          → apps/web (platform)     ← P2 اینجا
{club}.admin.app-tour.ir  → apps/web (operator)     ← Denali wizard host
apps/api/platform/*        → tenant CRUD · audit       ← P2 API
apps/api/workspace routes  → manifest → denali/http   ← Denali — P2 دست نزند
packages/workspaces/denali → wizard · finance · catalog ← ممنوع در P2
```

**Manifest SoT:** `packages/workspaces/denali/workspace.manifest.json`

- HTTP: `/denali/catalog`, `/denali/registrations`, `/finance/*`
- Tour write: `denaliTourPatchRequiresOwner`, `forbidOperatorMemberTourPatch: true`
- Events: `TourCreated` → ledger side effect

**Dispatch:** `scripts/generate-workspace-registry.mjs` → `workspace-http-routes.generated.ts` — platform route registrar **جدا** از workspace registrar.

---

## Guardهای اجباری (CI)

| Guard | فایل | چه چیزی را می‌بندد |
|-------|------|---------------------|
| `workspace-sdk-no-workspaces` | `dependency-cruiser.config.js` | SDK → denali |
| `no-denali-product-ids` | depcruise | platform-core → denali |
| `apps-api-workspace-plugin-registry-only` | depcruise | import مستقیم plugin خارج registry |
| `guard-workspace-registry-imports.mjs` | API script | `getDenaliWorkspacePlugin()` مستقیم |
| `import-boundary-ast.mjs` | monorepo | `packages/workspaces/` در foundation |
| `platform epic C boundary` | `apps/web/test/platform-epic-c-boundary.spec.ts` | `denali/ui` در `src/platform` |

**قبل از هر PR P2:** `pnpm run guard:import-boundary` + `pnpm run p1:gate` (platform specs).

---

## مجاز / ممنوع

### ✅ مجاز (P2 touch)

| مسیر | کار |
|------|-----|
| `apps/api/src/platform/*` | impersonate · billing · SSL adapter · offboard |
| `apps/api/src/routes/platform/*` | route handlers جدید |
| `apps/web/src/platform/*` | tab Billing · impersonate UI · Danger zone |
| `apps/web/app/(platform)/*` | pages |
| `apps/api/prisma/schema.prisma` | **فقط** جداول platform (`platform_*`, `tenant_subscriptions`) |
| `apps/marketing/*` | mother site stub (platformMode) — **بدون** import denali |

### ❌ ممنوع (بدون Architect + doc)

| مسیر | دلیل |
|------|------|
| `packages/workspaces/denali/**` | محصول — wizard · rules · finance |
| import `denali/ui` در platform web | boundary spec |
| import `@app-tour/workspace-denali` در `apps/api/src/platform` | فقط registry generated |
| تغییر `/finance/*` برای platform billing | billing باشگاه ≠ billing SaaS |
| bypass `denaliTourPatchRequiresOwner` در impersonate | canonical integrity |
| افزودن `workspaceType === "denali"` branch جدید در API | cap 5 فایل (phase-15 closure) |

---

## P2 feature → Denali impact matrix

| P2 feature | Denali package | Operator admin | Denali `/finance/*` |
|------------|----------------|----------------|---------------------|
| Impersonate read-only | **no change** | banner + 403 mutate | unchanged |
| Platform billing | **no change** | no billing UI P2 | unchanged |
| SSL / domains | **no change** | custom host routing infra | unchanged |
| Suspend / offboard | **no change** | login block via platform tenant status | routes may 403 tenant-wide |
| Provision seed | uses generic `seedWorkspaceWizardTemplateInTransaction` | — | seed از manifest devBootstrap |

**Suspend امروز (P1):** `assertTenantActiveForOperatorLogin` — فقط OTP operator؛ Denali HTTP/catalog همچنان tenant-scoped فعال unless offboard infra اضافه شود.

---

## Impersonate — قوانین Denali

1. Session flag `platform_impersonation_readonly` — middleware **apps/web operator** نه denali package
2. **POST/PATCH** tour canonical · finance · settings → **403** (حتی owner surface)
3. **GET** wizard/dashboard OK
4. Audit `IMPERSONATE_*` در platform_audit_events
5. **هرگز** claim `assertDenaliWorkspaceOwner` را جعل نکن — impersonation ≠ owner

---

## Platform billing vs Denali finance

| | Platform billing (P2-C) | Denali finance |
|--|-------------------------|----------------|
| Scope | SaaS plan · suspend club | tour payments · ledger |
| API | `/platform/v1/*` | `/finance/*` (manifest) |
| DB | `tenant_subscriptions` (new) | tenant RLS tables |
| UI | Super Admin Billing tab | operator finance panels |

---

## Checklist قبل merge هر EPIC P2

- [ ] `git diff packages/workspaces/denali` خالی (یا خارج scope PR)
- [ ] `platform-epic-c-boundary.spec.ts` pass
- [ ] `guard:import-boundary` pass
- [ ] Denali wizard E2E/smoke unchanged (owner handoff P1)
- [ ] `pnpm --filter @app-tour/workspace-denali test` اگر API/platform تغییر کرد

## مراجع

- `TEMP/wizard-denali-enterprise-assessment.md`
- `packages/workspaces/denali/README.md` Policy table
- `docs/phase-15/phase-15-closure.mdoc`
