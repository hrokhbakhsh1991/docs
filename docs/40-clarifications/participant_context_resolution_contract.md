# Participant Context Resolution Contract v1 (Draft)

## Context
Defines how participant identity and tenant context are derived across Telegram, Web, and reconnect/deep-link paths.
Implements CLAR-003 and supports CLAR-001.

## Scope & Out-of-Scope
### Scope
- Mode-specific identity derivation and tenant derivation.
- Session continuity rules for tenant/identity context.
- Fail-closed expectation when context is inconsistent.

### Out-of-Scope
- Full identity-linking state machine.
- Token/session lifecycle internals.
- UI wording and UX copy.

## Normative Basis
- `docs/20-architecture/technical_spec.md` (Identity/Auth, tenant-resolved participant views)
- `docs/30-analysis/step_03_system_requirements.md` (`SR-FR-008`, `SR-FR-009`, `SR-FR-010`, `SR-NFR-001`)
- `docs/20-architecture/contracts/participant_intake_schema.md` (`entry_mode`, conditional Telegram identity, `tenant_id`)
- `docs/50-validation/flow_consistency_validation.md` (mode-aware identity + tenant context)

## Global Rules
1. Participant identity MUST be derived from trusted mode-specific auth context.
2. Tenant MUST be resolved from trusted signals (see `docs/40-clarifications/tenant_boundary_policy.md`).
3. Mid-session tenant change for operational actions MUST NOT occur without fresh re-auth and re-resolution.
4. Ambiguous tenant context MUST fail closed (as defined in `docs/40-clarifications/tenant_boundary_policy.md`).

OPEN: Exact reconnect timeout threshold for stale context is not defined in active docs.

## Telegram Entry
- Identity derivation: server-validated Telegram auth/init payload.
- Tenant derivation: trusted route/workspace context and server-resolved tour ownership.
- Payload `tenant_id`: advisory only.

### Sequence Table (Telegram)
| Step | Actor | Action | Contract Result |
|---|---|---|---|
| TG-1 | Participant | Opens Telegram Mini App entry | Mode recognized as Telegram |
| TG-2 | System | Validates Telegram auth payload server-side | Identity trusted only after validation |
| TG-3 | System | Resolves tenant from trusted signals | Tenant context established |
| TG-4 | Participant/API | Sends request payload | Payload tenant checked for mismatch only |
| TG-5 | System | Evaluates consistency | Proceed on coherent context, else fail closed |

## Web Entry
- Identity derivation: authenticated web session/onboarding context.
- Tenant derivation: trusted workspace/route context.
- Connect Telegram is optional post-onboarding path (`SR-FR-010`).

### Sequence Table (Web)
| Step | Actor | Action | Contract Result |
|---|---|---|---|
| WB-1 | Participant | Opens web entry | Mode recognized as Web |
| WB-2 | System | Validates web auth/session | Identity established |
| WB-3 | System | Resolves tenant from trusted signals | Tenant context established |
| WB-4 | Participant/API | Sends payload with optional `tenant_id` | Payload tenant advisory only |
| WB-5 | System | Processes request | Deny mismatch; proceed only within tenant scope |

## Deep-Link / Reconnect Path
- Identity derivation: revalidated current auth context (Telegram or Web).
- Tenant derivation: trusted target route/resource + authorized scope.
- Ambiguous/missing context: fail closed.

### Sequence Table (Deep-Link/Reconnect)
| Step | Actor | Action | Contract Result |
|---|---|---|---|
| RC-1 | Participant | Opens deep link/reconnect | Intended mode/target inferred |
| RC-2 | System | Revalidates active identity context | Stale local context is not authoritative |
| RC-3 | System | Resolves tenant from trusted signals | Single coherent tenant required |
| RC-4 | System | Compares trusted vs payload remnants | Mismatch/ambiguity denied |
| RC-5 | System | Continue or deny | Continue only when context is coherent |
