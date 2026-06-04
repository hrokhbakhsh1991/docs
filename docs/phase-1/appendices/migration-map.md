# MIGRATION-MAP bridge §11

## MIGRATION-MAP BRIDGE §6–§10 (§11) — OUT OF SCOPE FOR PHASE 1

```yaml
deferred_not_implemented_phase_1:
  - map_section: 6
    topic: "Event bus + outbox"
    phase_1_role: "validateCanonical pure — emit in API phase 3-5"
  - map_section: 8
    topic: "contractVersion + migrate"
    phase_1_role: "pass-through fieldRegistry.version ruleSet.version only"
  - map_section: 10
    topic: "Observability PlatformLogger"
    phase_1_role: "no structured logging in platform-core barrel"

versioning_note: "breaking change policy MAP §8 — phase 2+ enforcement"
schema_generator_legacy: "denaliTourCreateBaseSchema.generated.ts — phase 3+ workspace or API NOT platform-core"
```

---

