# Denali portal member registrations — workspace delta

```yaml
doc_id: DENALI-PORTAL-MEMBER-REGISTRATIONS
version: "2026-07-02-v1"
extends: platform-portal-member.mdoc
workspace: denali
apps: [portal]
phase: P6-3
authority: platform-portal-member.mdoc · portal-registration-ui.md
```

## Scope

**Platform shell (workspace-agnostic):** [platform-portal-member.mdoc](../../phase-19/platform-portal-member.mdoc) — session, BFF routes, receipt upload chain.

**This doc:** Denali portal skin for `/me/registrations` list + detail + receipt upload. Business rules stay in API bookings/finance; portal **must not** static-import `@app-tour/workspace-denali`.

---

## Route → component tree

```text
app/me/layout.tsx
  └── app/me/registrations/page.tsx
        GET /api/me/registrations (SSR via fetchMemberRegistrations)
        main[data-portal-member-registrations]
          ul → li[data-portal-member-registration-row] → link

  └── app/me/registrations/[id]/page.tsx
        main[data-portal-member-registration-detail]
          MemberReceiptUploadForm (client)
```

---

## `data-*` hooks (E2E)

Stable selectors — **do not rename** without updating smoke specs.

| Hook | Location |
| ---- | -------- |
| `data-portal-member-registrations` | List page root (`main`) |
| `data-portal-member-registration-row` | Each list item |
| `data-portal-member-registration-detail` | Detail page root (`main`) |
| `data-portal-member-receipt-upload` | Receipt form shell |
| `data-portal-member-receipt-submit` | Upload button |
| `data-portal-member-receipt-success` | Success status |
| `data-portal-member-receipt-error` | Error alert |

Existing smokes: **SMK-PTL-02** (list) · **SMK-PTL-04** (receipt) · **SMK-PTL-05** (home redirect) · **SMK-PTL-06** (logout).

---

## Styling

| Rule | Detail |
| ---- | ------ |
| Scope | `body[data-app-surface="portal"][data-workspace-plugin="denali"]` |
| Skin file | `packages/workspaces/denali/theme/denali-portal.css` |
| List | `main[data-portal-member-registrations]` — card rows, tour title links, status badge (PS-M2 · 2026-07-12) |
| Detail | `main[data-portal-member-registration-detail]` — metadata + receipt panel |
| Receipt | `[data-portal-member-receipt-upload]` — file input + primary submit |
| Status badge | `[data-portal-member-registration-status-badge][data-status]` — `approved` · `pending` · `waitlisted` · `rejected` · `cancelled` |
| Row meta | `[data-portal-member-registration-meta]` — payment + departure |
| Empty state | `[data-portal-member-registrations-empty-state]` — message + CTA (PS-M2 · 2026-07-12) |
| Empty CTA | `[data-portal-member-registrations-empty-cta]` — egress to marketing `/tours` via `resolveMarketingToursUrl` |

Design SoT: `design-system/denali-club/MASTER.md` (primary `#059669`).

---

## Verification

| ID | Assert |
| -- | ------ |
| DEN-REG-01 | List page renders `data-portal-member-registrations` with Denali skin |
| DEN-REG-02 | Detail page renders receipt upload hooks |
| DEN-REG-03 | Receipt submit disabled while upload in flight |

Specs: `apps/portal/test/portal-member-registrations.spec.ts` (**MEM-BFF-03/04** · **MEM-SKIN-01**) · `apps/portal/tests/e2e/portal-member-smoke.spec.ts` (**SMK-PTL-02/04**) · `apps/api/test/denali-catalog.spec.ts` (**DCAT-07** · tour `…212` flags).

---

## References

- [platform-portal-member.mdoc](../../phase-19/platform-portal-member.mdoc)
- [portal-registration-ui.md](./portal-registration-ui.md) — registration success → `/me/registrations`
- [portal-member-profile.md](./portal-member-profile.md) — sibling `/me/profile` skin
