# Appendix — MIGRATION-MAP bridge & out of scope

## SECTION 14 — OUT OF SCOPE (DO NOT IMPLEMENT IN PHASE 0)

```yaml
deferred_to_migration_map:
  - { map_section: 5, topic: "Postgres Redis MinIO", implement_phase: "3+" }
  - { map_section: 6, topic: "Event bus transactional outbox", implement_phase: "4-5" }
  - { map_section: 7, topic: "RLS hybrid tenant routing", implement_phase: "4 design 7 enterprise" }
  - { map_section: 8, topic: "migrateCanonical adapter", implement_phase: "cutover 6" }
  - { map_section: 9, topic: "First-party plugins only", implement_phase: "until DoD" }
  - { map_section: 10, topic: "Observability audit", implement_phase: "min 3 full 7" }

known_contradiction_resolved:
  - "Phase 3 wants Postgres; tenant RLS Phase 4; Phase 3 tours single-tenant dev or tenant_id nullable until Phase 4"

sdk_fields_post_retrofit:
  - WorkspaceThemeContract theme on plugin: EXISTS packages/workspace-sdk/src/theme/
  - contractVersion on WorkspacePlugin: ENFORCED (G-06) — literal `1` on contract + starter reference plugin
```

---

## APPENDIX EXECUTION BINDINGS
