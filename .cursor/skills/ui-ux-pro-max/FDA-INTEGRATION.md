# UI UX Pro Max — FDA integration (advisory)

**Role:** Optional **design-intelligence** input for FDA CP1. **Advisory only** — repository design tokens, Denali workspace rules, product requirements, accessibility, RTL/LTR, and existing UI conventions **always win**.

**Charter:** [`docs/dev/feature-delivery-agent.mdoc`](../../../docs/dev/feature-delivery-agent.mdoc)  
**Gate:** [`docs/dev/feature-delivery/research-and-design-gate.mdoc`](../../../docs/dev/feature-delivery/research-and-design-gate.mdoc) §3.3  
**Artifact:** `.cache/feature-delivery/<sessionId>/ui-ux-decision.json`

---

## Detection (run at CP1)

```bash
# Skill present?
test -f .cursor/skills/ui-ux-pro-max/SKILL.md && test -f .cursor/skills/ui-ux-pro-max/scripts/search.py

# Python available?
python3 --version
```

| `uiUxProMaxUsed` | Condition |
| ---------------- | --------- |
| `true` | Skill files exist **and** `python3` runs **and** search command executed with stdout captured |
| `false` | Skill missing, Python missing, or search not run — **use fallback checklist only** |

**Never** set `uiUxProMaxUsed: true` without a ledger row for the exact search command.

---

## FDA workflow position

```text
CP0 discovery
  → product / IA analysis
  → UI UX Pro Max recommendations (when available)
  → repository design-system review (tokens, primitives, shell-skin)
  → ui-ux-decision.json + design-brief.json
  → CP2 plan → implementation → BQC browser verification
```

---

## Focused search commands (advisory)

Use **one or two** targeted queries — do not dump entire design system blindly.

```bash
# Design system bundle (product + style + color + typography)
python3 .cursor/skills/ui-ux-pro-max/scripts/search.py \
  "<product_type> <domain> <keywords>" --design-system -p "<featureId>"

# Domain-specific (examples)
python3 .cursor/skills/ui-ux-pro-max/scripts/search.py "<query>" --domain ux
python3 .cursor/skills/ui-ux-pro-max/scripts/search.py "<query>" --domain style
python3 .cursor/skills/ui-ux-pro-max/scripts/search.py "<query>" --stack nextjs
python3 .cursor/skills/ui-ux-pro-max/scripts/search.py "<query>" --stack shadcn
```

**Ask UI UX Pro Max about:** product type, visual style, layout pattern, hierarchy, color system, typography, spacing, responsive behavior, interaction patterns, UX anti-patterns, accessibility concerns.

**Then compare every recommendation against:**

- Denali theme (`design-system/`, `docs/phase-2-design-system.md`)
- Semantic tokens (`docs/dev/semantic-color-contract.mdoc`)
- Shell/skin primitives (`docs/standards/shell-skin-primitives-contract.mdoc`)
- Existing member/operator IA (Portal vs Web — PCMS-001)
- Persian RTL / English LTR localization patterns
- Product domain constraints

**Forbidden without explicit product approval:** arbitrary glassmorphism, gradients, animations, fonts, colors, icons, or new tabs solely because the skill suggested them.

---

## Repository design-system review (mandatory)

After UI UX Pro Max (or fallback), inspect:

| Source | Path |
| ------ | ---- |
| Design tokens | `design-system/` |
| Phase 2 spec | `docs/phase-2-design-system.md` |
| Semantic color | `docs/dev/semantic-color-contract.mdoc` |
| Shell primitives | `docs/standards/shell-skin-primitives-contract.mdoc` |
| Surface cohesion | `docs/standards/platform-surface-cohesion.mdoc` |
| Existing UI in target app | `apps/web/`, `apps/portal/`, `apps/marketing/` |

Record `designSystemSource` and `repositoryConstraints` in `ui-ux-decision.json`.

---

## Fallback checklist (when UI UX Pro Max unavailable)

Complete manually in `ui-ux-decision.json` with `uiUxProMaxUsed: false`:

1. User problem and primary task
2. Target actor and existing surface scan (dashboard, account, operator workspace, tours/registrations, notification bell, profile/detail)
3. Placement recommendation with **justification** — new tab requires documented reason
4. Information hierarchy and navigation
5. Desktop and mobile layout notes
6. Persian RTL and English LTR behavior
7. Typography, semantic color tokens, component primitives (repo-owned)
8. All interaction states: loading, empty, validation error, server error, permission denied, success, long content
9. Accessibility and keyboard behavior
10. Browser verification plan (BQC) — desktop, mobile, RTL, traces on failure

---

## Information architecture rules

Before a new page or tab, confirm the capability does not belong in:

- existing dashboard
- member account area
- operator workspace
- tours / registrations area
- notification bell
- profile or detail page

**Admin incomplete if only:** read-only catalog, static card, placeholder, seed, mock, API without usable UI, button without real mutation.

**Member incomplete without:** understandable copy, visible state, useful next action, loading/empty/error, permission behavior, mobile + RTL verification.

---

## Regression fixtures (UI/UX)

Flag in reviewer output when detected:

| Fixture | Signal |
| ------- | ------ |
| Wrong tab | New nav item duplicates existing IA |
| Admin decoration | Read-only catalog claimed as admin feature |
| Member leak | Internal/operator fields in member projection |
| Negative exposure | Negative values in member-facing UI |
| Wallet/engagement conflation | Visual merge of unrelated domains |
| Mobile RTL gap | Desktop pass, mobile Persian fail |
| API-only proof | API green, browser flow red |
| Screenshot theater | Image without interaction evidence |
| Token drift | New arbitrary styles vs Denali tokens |
| Environment lie | Local/staging evidence reported as production |

---

## Ledger binding

| gate_id | Binds to |
| ------- | -------- |
| `uiux.decision` | `ui-ux-decision.json` |
| `uiux.promax.<query-slug>` | Search command stdout (when used) |
| `design.brief` | `design-brief.json` (still required) |

---

_See [`UPSTREAM-AUDIT.md`](UPSTREAM-AUDIT.md) for vendor provenance and security notes._
