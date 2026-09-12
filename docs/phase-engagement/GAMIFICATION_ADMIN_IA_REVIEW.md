# GAMIFICATION_ADMIN_IA_REVIEW

**Feature:** MEG-001 operator admin information architecture  
**Branch:** `cursor/gamification-5bda`  
**Date:** 2026-09-04  
**Verdict:** **Restructure required** — member operations belong in Users; global configuration remains in Engagement.

---

## 1. Current structure (before)

| Surface | Route | Contents |
| ------- | ----- | -------- |
| **Users** | `/users` | Directory search (name/phone), member detail sheet (access, benefits, activity, trips) — **no engagement** |
| **Engagement** | `/engagement` | Tabs: Overview, Badges, Levels, Award Rules, **Members** (duplicate search + adjust/reverse), Audit |

**Navigation order:** Dashboard → Tours → Bookings → … → **Users** → Settings → Finance → Wallet → **Engagement**

**BFF:** Shared `/api/engagement/members/:userId` lookup/adjust/reverse; Users directory uses `/api/users` search.

---

## 2. Problems

1. **Duplicate member workflow** — Engagement › Members tab repeated Users directory search and member mutations.
2. **Wrong mental model** — Operators expect member context (name, phone, role) on Users; Engagement should be system policy.
3. **UUID-hidden but search-duplicated** — Members tab used directory search correctly but isolated from member detail.
4. **Confusing IA** — Two places to adjust points; no link between them.
5. **Extra API calls** — Same `/api/users` + `/api/engagement/members/:id` chain from Engagement Members tab instead of once from User Detail.

---

## 3. Recommended structure (after)

### Users (`/users`)

- Directory search by name/phone (unchanged)
- Member detail sheet adds **Engagement** section:
  - Points, level, earned badge count
  - Point history with actor/reason/timestamp
  - Adjust / reverse (owner/admin; viewer read-only)
  - Uses shared `MemberEngagementPanel` component

### Engagement (`/engagement`)

- **Overview** — tenant-wide recent awards + link to Users for member ops
- **Badges / Levels / Award Rules** — global definition CRUD (unchanged)
- **Audit** — definition mutation audit log (unchanged)
- **Removed:** Members tab (no duplicate search)

---

## 4. Rejected alternatives

| Alternative | Why rejected |
| ----------- | ------------ |
| Move badge/level/rule CRUD into Users | Violates separation of system config vs member ops; duplicates admin surface |
| Remove Engagement nav entirely | Global policy management still needed; overview analytics useful |
| Keep Members tab as shortcut | Perpetuates duplicate search and split source of truth |
| New top-level “Gamification” nav | Unnecessary; Engagement label is correct for policy |

---

## 5. Acceptance criteria

- [x] Operator finds member by name/phone on **Users** without UUID
- [x] Member detail shows engagement points, level, badges, history
- [x] Owner/admin can adjust/reverse with reason; viewer read-only
- [x] Engagement retains badge/level/rule management and audit
- [x] Engagement overview links to Users; no Members tab
- [x] Single `MemberEngagementPanel` — no duplicated mutation logic
- [x] RTL/mobile layouts preserved (sheet + responsive grids)
- [x] Playwright `SMK-MEG-OP-05` exercises Users › Detail › Engagement path

---

## 6. Evidence

| Artifact | Path |
| -------- | ---- |
| Users member engagement (after) | `/opt/cursor/artifacts/ia-after-users-member-engagement.png` |
| Adjust/reverse flow | `/opt/cursor/artifacts/operator-engagement-adjust-reverse.png` |
| Engagement overview (no Members tab) | Playwright `SMK-MEG-OP-01` |
| Portal member outcome | `SMK-MEG-02`, `SMK-MEG-05` |

---

## 7. UX references (adapted, not copied)

- **Nielsen — Match between system and real world:** Member-centric tasks live with member records ([nngroup.com](https://www.nngroup.com/articles/ten-usability-heuristics/)).
- **WCAG 2.2 — Consistent navigation:** One canonical path for member point adjustments reduces cognitive load.
- **Progressive disclosure:** Global policy in Engagement; member ledger in User Detail sheet section.

---

_Implemented in commits on `cursor/gamification-5bda` following this review._
