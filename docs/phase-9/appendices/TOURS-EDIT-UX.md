# Phase 9.3 — Tour Edit (Operator UX + API)

```yaml
ux_spec_id: TOURS-EDIT-UX
version: "2026-06-24-v2"
status: LOCKED
decisions: [DEC-P9-007, DEC-P9-013, DEC-P9-014]
subphase: "9.3"
scope: "(app)/tours/[id]/edit — R1 title shell; Denali operators use Phase 12.4 flat edit (see supersession)"
authority: subphases/9.3-tours-operator.md · TOURS-LIST-UX.md · tours-operator-api-dispatch-addendum.md
pattern: ADMIN-SHELL-UX.md
legacy_reference:
  - legacy/apps/web/app/(app)/tours/[id]/edit/tour-edit-client.tsx
trunk_baseline:
  - apps/api/src/tours/tours.routes.ts
  - apps/web/app/(app)/tours/tour-card.tsx
```

> **Problem:** Operator list links to `/tours/{id}/edit` but trunk has no edit route — View returns 404. Legacy ships full `DenaliTourEditForm`; Phase 9 R1 delivers a **session-gated detail shell** with projection display and optimistic title PATCH.

> **Supersession (Phase 12.4 + styling 2026-06-24):** Denali admin/owner sessions route to **`DenaliFlatEditPageClient`** — full flat form (all wizard sections minus review), save/publish/unpublish, draft autosave. Members and non-Denali tenants keep R1 title-only shell below. Composite field skin: [`wizard-experience.md`](../../workspaces/denali/wizard-experience.md#flat-edit-skin-bridge) — page root `data-new-tour-wizard` via `DenaliFlatEditPageShell`. Authority: [`12.4-denali-flat-edit-form.md`](../../phase-12/subphases/12.4-denali-flat-edit-form.md).

---

## 1. Gap analysis (trunk 2026-06-08)

| Layer | Status | Notes |
| ----- | ------ | ----- |
| `GET /tours/{id}` operator session | ❌ → ✅ R1 | Was tenant-kernel only; dispatch requires `requireOperatorSession` |
| `GET` response projection | ❌ → ✅ R1 | Reuse `buildTourListProjection` — no Denali paths in web |
| `(app)/tours/[id]/edit` | ❌ → ✅ R1 | shadcn mobile-first (DEC-P9-013 R1) |
| Full Denali edit form | ❌ | Deferred — R2+ |
| Workspace subnav | ❌ | 9.3 later round |

---

## 2. API — operator tour detail (S9.3-E-R1)

### 2.1 GET `/tours/{id}`

**Session:** `requireOperatorSession` — anonymous → `401 IDENTITY_REQUIRED`.

**Response 200:**

```typescript
export type OperatorTourDetailResponse = {
  readonly id: string;
  readonly tenantId: string;
  readonly rowVersion: number;
  readonly canonical: CanonicalDocument;
  readonly projection: TourListProjection; // TOURS-LIST-PROJECTION.schema.json
};
```

**Projection extraction:** `get-tour-operator.ts` calls workspace plugin `extractTourListProjection` via `buildTourListProjection` (same pipeline as list).

**404:** `{ code: "TOUR_NOT_FOUND" }` when row absent or CASL denies read.

### 2.2 PATCH `/tours/{id}` (existing)

- **Member** → `403 OPERATOR_TOUR_WRITE_FORBIDDEN`
- **Admin/owner** → `200` with updated record
- Body: `{ rowVersion, data?, roots? }` — R1 web sends title patch in `data` roots per workspace canonical shape

---

## 3. Web — edit page R1

### 3.1 File layout

```text
apps/web/app/(app)/tours/[id]/edit/
  page.tsx
  tour-edit-page-client.tsx
apps/web/app/api/tours/[id]/route.ts   # GET + PATCH BFF proxy
apps/web/src/features/tours/
  operator-tour-detail-types.ts
  build-tour-title-patch.ts            # workspace-agnostic title patch builder
```

### 3.2 Mobile wireframe

```text
┌─────────────────────────────────────┐
│ ← Tours · Desert trek               │
├─────────────────────────────────────┤
│ [badge: Draft]                      │
│ Jul 15, 2026 · $1,200 · 0/12 seats  │
│ Short description (read-only)       │
├─────────────────────────────────────┤
│ Title                               │
│ [ Desert trek ................. ]   │
│ [ Save changes ]                    │
└─────────────────────────────────────┘
```

**Member:** same layout, title input disabled, no Save button.

### 3.3 Test IDs

| ID | Element |
| -- | ------- |
| `operator-tour-edit-page` | page root |
| `operator-tour-edit-title` | title input |
| `operator-tour-edit-save` | save button (admin/owner only) |

---

## 4. Role matrix

| Action | owner | admin | member |
| ------ | ----- | ----- | ------ |
| View edit page | ✅ | ✅ | ✅ |
| Edit title | ✅ | ✅ | ❌ read-only |
| PATCH tour | ✅ | ✅ | ❌ 403 |

---

## 5. Completion proof (edit R1)

| ID | Check | Pass |
| -- | ----- | ---- |
| CP-9.3-E01 | GET `/tours/{id}` without session → 401 | API spec |
| CP-9.3-E02 | GET with session returns `projection` | API spec |
| CP-9.3-E03 | `(app)/tours/[id]/edit` renders post-login | WEB spec |
| CP-9.3-E04 | Member UI hides save / disables title | WEB spec |

---

## 6. Verification

```bash
pnpm --filter @apps/api exec node --import tsx --test test/tours-operator.spec.ts
pnpm --filter @apps/web exec node --import tsx --import ./test/register-dom.mjs --test test/tours-edit.spec.ts
```
