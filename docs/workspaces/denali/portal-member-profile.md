# Denali portal member profile — workspace delta

```yaml
doc_id: DENALI-PORTAL-MEMBER-PROFILE
version: "2026-07-02-v2"
extends: platform-portal-member-profile.mdoc
workspace: denali
apps: [portal]
phase: P6-3
authority: platform-portal-member-profile.mdoc · portal-registration-ui.md
```

## Scope

**Platform shell (workspace-agnostic):** [platform-portal-member-profile.mdoc](../../phase-19/platform-portal-member-profile.mdoc) — `MemberProfileView` / `MemberProfilePatch`, `GET/PATCH /api/me/profile`, `resolveMemberProfileCapabilities(pluginId)`.

**This doc:** Denali-specific profile field deltas, intake linkage, E2E hooks, and roadmap fields. Urban differences are capability-driven in SDK — no Denali imports in portal.

Portal **must not** static-import `@app-tour/workspace-denali`. Denali rules for registration validation remain in `packages/workspaces/denali`; profile persistence stays on `identity/me`.

---

## SDK capability row (v2 · 2026-07-02)

Module: `packages/workspace-sdk/src/profile/resolve-member-profile-capabilities.ts`

Registered in `resolveMemberProfileCapabilities("denali")` (manifest-generated):

| Capability | Value |
| ---------- | ----- |
| `editableFields` | `displayName`, `email`, `gender`, `nationalId`, `fatherName`, `birthDate` |
| `readOnlyFields` | `mobile` (display + OTP change flow — not PATCH) |
| `mobileChangeViaOtp` | `true` |
| `sections` | `identity` → displayName · mobile · email · **gender** · `participant` → nationalId · fatherName · birthDate |

**Avatar (enterprise):** separate upload surface — `POST/DELETE /api/me/avatar` portal BFF → `identity/me/avatar` (same storage as operator admin). UI shows preview + upload/remove; not a text `avatarUrl` field in the PATCH form.

**Mobile change (enterprise · v2):** `mobile` stays **out of** `PATCH /api/me/profile`. Self-service change uses authenticated OTP to the **new** number:

```text
POST /api/me/mobile/request-otp  →  POST /identity/me/mobile/request-otp
POST /api/me/mobile/verify       →  POST /identity/me/mobile/verify  (+ new session cookie)
```

On commit: `User.mobile` updates globally · all memberships `sessionVersion` bump · portal refreshes `atour_mb_session`.

**v1 freeze note:** v1 had `displayName` read-only and no avatar — superseded by v2 for Denali customer profile.

---

## Link to registration intake

Denali intake (`resolveCatalogIntakeCapabilities`) shares participant fields with profile:

| Field | `/me/profile` | Tour intake (`self`) | Tour intake (`other`) |
| ----- | ------------- | -------------------- | --------------------- |
| `displayName` | **editable** | hidden if profile has name | booker fills guest name |
| `email` | **editable** | not at intake (Denali) | — |
| `mobile` | read-only in PATCH · **change via OTP** | — | — |
| `nationalId` | editable | shown if tour `nationalIdRequired` **and** profile empty | shown when tour requires |
| `fatherName` | editable | same pattern with `fatherNameRequired` | same |
| `birthDate` | editable | same pattern with `birthDateRequired` | same |
| `gender` | **editable** (select · SDK enum) | not at intake | — |
| `avatarUrl` | upload surface (not PATCH text) | — | — |

**Persist rule (unchanged):** intake may patch profile fields **only when** `registrantTarget=self` after `POST /denali/registrations` (see `registration.service.ts`).

**Pre-fill rule:** registration flow reads `GET /api/me/profile` (M3).

---

## Route → component tree (target)

```text
app/me/layout.tsx
  └── app/me/profile/page.tsx
        GET /api/me/profile (SSR — same-origin BFF only)
        MemberProfileForm (client)
          fields ← resolveMemberProfileCapabilities(pluginId).editableFields
          PATCH /api/me/profile
```

### Discoverability (2026-07-12)

| Entry | Location |
| ----- | -------- |
| Header | `user_menu` link «پروفایل» |
| Bottom nav | Profile tab with User icon (when entitled) |
| Home | Quick-link card on `/me/home` |

Direct URL: `/me/profile`.

## Cross-surface parity (portal · admin · marketing)

| Field | Portal `/me/profile` | Admin `/settings/me` | Marketing |
| ----- | -------------------- | -------------------- | --------- |
| `displayName` | PATCH (BFF) | PATCH (`/api/identity/me`) | onboarding step only |
| `email` | PATCH (Denali) | — | onboarding step |
| `mobile` | read-only + OTP BFF | read-only | registration OTP |
| `gender` | PATCH · `OPERATOR_PROFILE_GENDERS` | PATCH · same enum | — |
| `nationalId` / `fatherName` / `birthDate` | PATCH (Denali manifest) | — | intake when required |
| `avatar` | `/api/me/avatar*` | `/api/identity/me/avatar*` | — |

Shared storage: `GET/PATCH /identity/me` · `membershipMetadata`. Portal must use `/api/me/profile` BFF only (INV-MP-01). Marketing has no settings page (PCMS-001).

### Current implementation (post-M6 · repo truth)

| Piece | Today | Governance |
| ----- | ----- | ---------- |
| SSR load | `GET /api/me/profile` via `fetchMemberProfile` | `architecture-truth-guard` |
| Client save | `PATCH /api/me/profile` | boundary guard |
| Field list | Capability-driven (`capabilities.editableFields`) | SDK registry |
| Validation | BFF SDK validators + API coded errors | no UI regex |

---

## `data-*` hooks (E2E)

| Hook | Location |
| ---- | -------- |
| `main[data-portal-member-profile]` | Page shell (`app/me/profile/page.tsx`) — E2E navigation target |
| `data-portal-member-profile` | Client form root (`member-profile-form.tsx`) |
| `data-member-profile-ready="true"` | Form after client hydration — DEN-PROF save must wait (avoids native GET submit before React onClick) |
| `data-member-profile-field="displayName"` | Editable identity slot |
| `data-member-profile-field="email"` | Editable identity slot |
| `data-member-profile-field="mobile"` | Current mobile + change flow trigger |
| `data-member-profile-mobile-change` | Mobile change step machine root |
| `data-member-profile-mobile-change-request` | Request OTP for new mobile |
| `data-member-profile-mobile-change-verify` | Verify OTP + commit |
| `data-member-profile-avatar` | Avatar preview + upload/remove |
| `data-member-profile-avatar-upload` | File input trigger |
| `data-member-profile-avatar-remove` | Remove avatar button |
| `data-member-profile-field="gender"` | Gender select (`OPERATOR_PROFILE_GENDERS`) |
| `data-member-profile-save` | Save button (`type="button"` · `PATCH /api/me/profile`) |

Smoke warmup: `apps/portal/tests/e2e/portal-smoke-global-setup.ts` pre-compiles `/catalog/{210,212}/register` before Playwright navigation (first dev compile can exceed 90s).

Covered by `MEM-PROF-01` in `portal-member-registrations.spec.ts` and **DEN-PROF-01..05** in `portal-member-profile-smoke.spec.ts`.

---

## Styling

| Rule | Detail |
| ---- | ------ |
| Scope | `body[data-app-surface="portal"][data-workspace-plugin="denali"]` |
| Skin file | `packages/workspaces/denali/theme/denali-portal.css` |
| Profile shell | `main[data-portal-member-profile]` inside `[data-portal-shell]` member chrome (PS-7) |
| E2E | `portal-member-profile-smoke.spec.ts` — DEN-PROF-01..05 |

Design SoT: `design-system/denali-club/MASTER.md` (primary `#059669`).

---

## Roadmap fields (not v1)

Denali field registry (`denaliFieldRegistryData.ts`) marks these as `palette_roadmap` — **do not** add to portal until platform freeze extends metadata + egress:

| Canonical flag | Purpose |
| -------------- | ------- |
| `participantRequirements.medicationsRequired` | Trek medical form |
| `participantRequirements.allergiesRequired` | Allergies |
| `participantRequirements.dietaryRequirementsRequired` | Dietary restrictions |

Requires: SDK capability extension · `membershipMetadata` schema doc · PII egress review — not portal-only work.

---

## Verification

| ID | Assert |
| -- | ------ |
| DEN-PROF-01 | Denali `/me/profile` shows identity + participant fields + avatar |
| DEN-PROF-02 | PATCH persists participant fields · intake pre-fill reflects saved nationalId |
| DEN-PROF-03 | Tour with `nationalIdRequired` hides intake field when profile already has nationalId |
| DEN-PROF-04 | Mobile change via OTP updates `User.mobile` and refreshes session |
| DEN-PROF-05 | Gender select PATCH persists · reload shows saved value |
| MEM-AUTH-01 | `POST /api/public-auth/logout` clears `atour_mb_session` |
| MEM-AUTH-02 | `/me` nav exposes `data-public-auth-logout` → portal home |

Specs: `packages/workspace-sdk/test/resolve-member-profile-capabilities.spec.ts` (**SDK-MP-CAP-01..04**) · `apps/portal/test/portal-member-profile-bff.spec.ts` (**MP-BFF-01..14**) · `apps/portal/test/portal-public-auth-logout.spec.ts` (**MEM-AUTH-01**) · `apps/portal/tests/e2e/portal-member-profile-smoke.spec.ts` (**DEN-PROF-01..05**) · `apps/api/test/identity-me-mobile-change.spec.ts` (**API-ME-MOB-01..06**).

---

## References

- [platform-portal-member-profile.mdoc](../../phase-19/platform-portal-member-profile.mdoc)
- [portal-registration-ui.md](./portal-registration-ui.md) — intake + profile-backed fields
- [public-catalog.md](./public-catalog.md) § Registration
- [IDENTITY-PORT-SCOPE.md](../../phase-9/appendices/IDENTITY-PORT-SCOPE.md) — `/identity/me` field table
