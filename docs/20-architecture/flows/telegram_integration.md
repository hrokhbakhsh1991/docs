Document-ID: MKT-FLOW-TELEGRAM-INTEGRATION-V2
Version: v1.0
Status: Active
Owner: Product Documentation Team
Last-Updated: 2026-04-27
Language: English
Canonical-Reference: docs/20-architecture/canonical_framework.md

# Telegram Integration Flow v2

## Purpose
Define Telegram-related behavior in leader-centric dual-mode product.

## Scope
- communication link governance
- mode-aware identity behavior

## Communication Link Rule
- Tour Telegram link is visible only to participants with `Registration.status = Accepted`.
- Non-accepted and waitlist states cannot access the link.

## Dual-Mode Identity Rule
- Telegram mode:
  - user enters through Telegram Mini App
  - Telegram identity is required
- Web mode:
  - user can start without Telegram
  - user should be offered `Connect Telegram` after onboarding

## Operational Boundaries
- Product complements messaging channels; it does not replace chat.
- Telegram behavior must remain consistent with registration status controls.

## Tenant Safety
- Telegram link management and visibility checks are tenant-scoped.

## Related Backend References
- `docs/20-architecture/technical_spec.md`
- `docs/20-architecture/contracts/participant_intake_schema.md`
- `docs/20-architecture/flows/registration.md`

---

## Changelog

- 2026-04-28: Added backend cross-references for identity, intake, and registration-status governance.
