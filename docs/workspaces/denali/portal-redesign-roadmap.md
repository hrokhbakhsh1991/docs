# Denali portal redesign roadmap

```yaml
doc_id: DENALI-PORTAL-REDESIGN-ROADMAP
version: "2026-08-14-v1"
extends: portal-registration-ui.md · portal-member-ui.md · portal-member-desktop-frame.md
apps: [portal]
status: active
```

## Goal

Redesign the **Denali portal** step by step without changing API contracts, member flows, or workspace business logic.

This roadmap is the working plan for a **portal-only visual rewrite**:

- keep `apps/api` unchanged
- keep portal BFF contracts unchanged
- keep registration / profile / receipt behaviors unchanged
- improve only presentation, layout, affordance, and visual consistency

## Non-negotiable boundaries

### In scope

- `apps/portal/app/**` page composition and presentational markup
- `apps/portal/src/**` portal shell and UX composition
- `packages/workspaces/denali/theme/portal/**`
- `packages/workspaces/denali/theme/denali-portal.css`
- `packages/design-tokens/dtcg/workspaces/denali.portal.tokens.json`

### Out of scope

- `apps/api/**`
- workspace HTTP routes / schemas / write paths
- registration state machine semantics
- auth / BFF behavior
- operator admin surfaces

### Code-shape rules

- portal redesign must stay **surface-local**
- no Denali portal CSS should leak into admin or marketing selectors
- prefer existing `data-*` hooks over ad-hoc class proliferation
- add shared portal patterns in theme files before patching individual pages
- do not fork business logic to make a visual state easier to style

## Reference direction

Primary reference blend:

- **Stripe Checkout / Elements** for mobile-first form UX, field rhythm, errors, and submit affordances
- **Linear** for hierarchy, typography restraint, page calmness, and desktop polish

Target feel:

- premium member portal
- calm, guided, trustworthy
- clear next action on every page
- no heavy admin-dashboard look
- no marketing-page theatrics inside authenticated member routes

## Current-state audit

The current Denali portal already has multiple visual waves and useful structure:

- auth / registration shell:
  - `apps/portal/src/catalog/portal-auth-experience-shell.tsx`
  - `packages/workspaces/denali/theme/portal/login-page.css`
- member shell:
  - `apps/portal/src/shell/portal-member-shell.tsx`
  - `packages/workspaces/denali/theme/portal/member-shell.css`
  - `packages/workspaces/denali/theme/portal/member-shell-desktop.css`
- shared form controls:
  - `packages/workspaces/denali/theme/portal/denali-form-controls.css`
- page pack:
  - `packages/workspaces/denali/theme/portal/member-pages.css`
  - `packages/workspaces/denali/theme/portal/member-pages-desktop.css`
  - `packages/workspaces/denali/theme/portal/member-profile.css`

So the redesign should **refine and unify**, not restart from zero.

## Page-by-page audit

### 1. Registration flow

Primary files:

- `apps/portal/app/catalog/[tourId]/register/page.tsx`
- `apps/portal/src/catalog/public-catalog-registration-flow.tsx`
- `apps/portal/src/catalog/catalog-registration-stepper.tsx`
- `apps/portal/src/catalog/portal-auth-experience-shell.tsx`

Why it goes first:

- highest emotional impact
- strongest mobile importance
- contains the portal's clearest multi-step guided journey
- its visual rules can become the base system for the rest of portal

Current strengths:

- already isolated in a dedicated auth shell
- resume / guest / login states are structurally explicit
- stepper has stable hooks and mode variants

Current visual risks:

- card, stepper, and form controls still feel like separate layers instead of one coherent product surface
- hero / chrome / gate / step content hierarchy can still feel crowded
- success, intake, and alert states need stronger consistency

Design target:

- one calm guided card
- stronger progress clarity
- clearer primary action hierarchy
- cleaner mobile spacing
- more premium desktop centering and breathing room

### 2. Login experience

Primary files:

- `apps/portal/app/login/page.tsx`
- `apps/portal/src/auth/portal-login-modal.tsx`
- `apps/portal/src/auth/portal-login-modal-opener.tsx`
- `packages/workspaces/denali/theme/portal/login-page.css`

Why it follows registration:

- it shares the same auth foundation
- improvements should reuse the exact same field, button, modal, and hero language

Current visual risks:

- thin-host login can feel detached from the richer registration shell
- modal and full-page host need stronger parity
- OTP entry needs clearer focus, pacing, and confidence cues

Design target:

- same visual language as registration
- thinner copy, stronger field rhythm
- obvious current step and next action

### 3. Member shell

Primary files:

- `apps/portal/app/me/layout.tsx`
- `apps/portal/src/shell/portal-member-shell.tsx`
- `apps/portal/src/shell/portal-member-header.tsx`
- `apps/portal/src/shell/portal-member-bottom-nav.tsx`
- `packages/workspaces/denali/theme/portal/member-shell.css`
- `packages/workspaces/denali/theme/portal/member-shell-desktop.css`

Why it comes third:

- once auth and registration are coherent, the same tone should carry into `/me/*`
- shell changes affect every authenticated page

Current strengths:

- desktop side rail and mobile shell already exist
- structure is separated from business logic

Current visual risks:

- shell/header/page body can still read as assembled pieces instead of one system
- content canvas and card surfaces need tighter consistency
- some density decisions differ too much between mobile and desktop

Design target:

- simpler identity chrome
- more deliberate content frame
- desktop that feels elegant, not dashboard-heavy

### 4. Member home

Primary files:

- `apps/portal/app/me/home/page.tsx`
- `apps/portal/app/me/home/member-home-quick-links.tsx`
- `packages/workspaces/denali/theme/portal/member-pages.css`

Current visual risks:

- quick-link cards may feel generic rather than intentional
- hierarchy between welcome copy and actions can be stronger

Design target:

- concise welcoming surface
- action cards with better icon / label / spacing rhythm
- clearer “start here” behavior

### 5. Registrations list

Primary files:

- `apps/portal/app/me/registrations/page.tsx`
- `packages/workspaces/denali/theme/portal/member-pages.css`

Current visual risks:

- filters, cards, statuses, and empty states need stronger common rhythm
- list rows need more polished scanning on desktop

Design target:

- easier visual scanning
- cleaner status emphasis
- stronger distinction between self / other registrations without noise

### 6. Registration detail

Primary files:

- `apps/portal/app/me/registrations/[id]/page.tsx`
- `apps/portal/app/me/registrations/[id]/member-intake-amend-form.tsx`
- `apps/portal/app/me/registrations/[id]/member-receipt-upload-form.tsx`

Current visual risks:

- hero, amend form, and receipt/payment surfaces may feel visually unrelated
- operational states need stronger grouping and pacing

Design target:

- a clean detail narrative:
  registration summary → actions → payment / receipt guidance

### 7. Profile

Primary files:

- `apps/portal/app/me/profile/page.tsx`
- `apps/portal/app/me/profile/member-profile-form.tsx`
- `packages/workspaces/denali/theme/portal/member-profile.css`

Current state:

- already has a more advanced sectioned desktop pattern

Risk:

- profile can become visually ahead of the rest of the portal and feel like a different product

Design target:

- keep the sectioned settings pattern
- align its field, spacing, and action language with registration/login foundation

## Execution order

### Phase 1 — foundation

Build one shared visual foundation before page-specific rewrites:

- token review for portal-only semantics
- shared auth/member spacing scale
- shared card surface rules
- shared form control rules
- shared primary / secondary action rules
- shared alert / empty / success state rules

Primary files:

- `packages/design-tokens/dtcg/workspaces/denali.portal.tokens.json`
- `packages/workspaces/denali/theme/denali-portal.css`
- `packages/workspaces/denali/theme/portal/denali-form-controls.css`
- `packages/workspaces/denali/theme/portal/login-page.css`

### Phase 2 — registration pilot

Use self-registration as the proving ground:

- hero + chrome
- stepper
- auth gate
- intake form
- success state

Success condition:

- mobile first feels substantially improved
- desktop stays elegant and uncluttered
- no logic changes

### Phase 3 — login parity

Apply the same auth language to `/login` and modal states.

### Phase 4 — member shell and page pack

Roll shared page structure and content surfaces across:

- `/me/home`
- `/me/registrations`
- `/me/registrations/[id]`
- `/me/profile`

## Verification method

Every phase must be checked in three ways:

### 1. Source audit

- boundary stays portal-only
- no API or contract drift
- no duplicated one-off page styling when a shared portal pattern should own it

### 2. Automated checks

Prefer focused visual and portal tests first, then broader checks as needed:

```bash
pnpm --filter @apps/portal test -- \
  test/portal-visual-wave1.spec.ts \
  test/portal-visual-wave2.spec.ts \
  test/portal-visual-wave4.spec.ts \
  test/portal-visual-wave5.spec.ts \
  test/portal-member-shell.spec.ts
```

For broader portal smoke when needed:

```bash
pnpm --filter @apps/portal run test:smoke
```

### 3. Live page review

Before calling a phase done, review actual pages in both mobile and desktop:

- registration
- login
- home
- registrations list
- registration detail
- profile

Each review should answer:

- Is hierarchy clearer?
- Is the next action obvious?
- Does mobile feel first-class?
- Does desktop feel intentional rather than stretched mobile?
- Does this still look like one product?

## Immediate next move

Start with **Phase 1 foundation**, but only for the auth/registration surface:

1. tighten portal auth spacing and card rules
2. unify field / button / alert language
3. simplify stepper visual rhythm
4. then review registration page live before moving to the next page pack

This keeps the first implementation small enough to stay safe, while still moving toward the full portal redesign.
