# Legacy urban reference (profile vs plugin)

```yaml
reference_version: "2026-06-04-v2"
decision: DEC-P7-003
non_authoritative_for_execution: true
```

## Critical distinction

| Concept           | Legacy                                                          | Phase 7 trunk                 |
| ----------------- | --------------------------------------------------------------- | ----------------------------- |
| `urban_event`     | **Form profile** in `tour-form-profile-descriptors.ts` L283–299 | Slim field registry in plugin |
| Workspace package | **Does not exist**                                              | `packages/workspaces/urban`   |
| Wizard rail       | `urban_event` → **Denali rail** L11–13 (**forbidden**)          | Independent urban plugin      |

## Legacy paths (reference only)

| Path                                                                        | Line     | Use                                                    |
| --------------------------------------------------------------------------- | -------- | ------------------------------------------------------ |
| `legacy/packages/types/src/tour-form-profile-descriptors.ts`                | L283–299 | Strip rules for itinerary/transport                    |
| `legacy/apps/web/src/features/tours/wizard/workspace-wizard.config.spec.ts` | L11–13   | **Anti-pattern** — `wizardMode === "denali"` for urban |
| `legacy/apps/api/src/scripts/urban-demo-tenant.fixture.ts`                  | —        | Smoke fixture inspiration                              |

## Anti-pattern (do not replicate)

From `workspace-wizard.config.spec.ts`:

```typescript
// LEGACY — FORBIDDEN in trunk Phase 7
assert.equal(getWizardConfig("urban_event").wizardMode, "denali");
```

Phase 7 trunk: urban tenant → `@app-tour/workspace-urban` plugin via generic resolver.

## Strip semantics (port as plugin policy)

From `tour-form-profile-descriptors.ts` L283–299:

- `inactiveFieldGroups: ["itinerary", "participation", "logistics"]`
- `clearsRootTransportModes: true`
- `defaultTourType: "city"`

Mapped in [`URBAN-MINIMAL-SCOPE.md`](URBAN-MINIMAL-SCOPE.md).

**Do not** import legacy types at runtime (DEC-P7-013).

## Verification

- RULE-P7-003 — P7-X-A02 anti-rail guard
- REQ-P7-011 — bootstrap review
