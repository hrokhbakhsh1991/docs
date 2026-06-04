# MIGRATION MAP BRIDGE (§16 · §15 preview)

## PHASE 3 ROADMAP PREVIEW — CASL × INGRESS (§15) — EXECUTION DEFERRED

```yaml
phase_3_preview_not_phase_2_scope:
  authorization_policy:
    - "all RBAC/ABAC in workspace-sdk CASL — no if (user.role) in routes"
    - "ability.ts single SoT for apps/api apps/web theme-react"
    - "platform-core stays headless — no CASL"
  casl_entities_minimum:
    - Workspace: [read, update, publish]
    - Tenant: [read, manage]
    - Plugin: [install, configure, read]
    - WorkspaceTheme: [access, update]
  cross_layer_security:
    order:
      - defineAbilityFor(context)
      - ability.can(access, workspaceThemeSubject)
      - validateWorkspaceThemeIngress
      - snapshotWorkspaceTheme
    skip_casl_only: "safe CSS leaks to unauthorized actor"
    skip_ingress_only: "authorized actor may inject unsafe CSS"
    ingress_before_casl: FORBIDDEN
  workspace_theme_provider_contract_sketch:
    props: [plugin, theme?, ability, workspaceThemeSubject, children]
    deny_behavior: "render children without workspace theme wrapper — ingress NOT called"
  database_guardrails_phase_3:
    rule: "Prisma findMany/update use accessibleBy(ability)"
    raw_sql: forbidden phase 3 unless RLS + review phase 4+
  map_subphases:
    - "3.0 ability.ts + theme provider gate + accessibleBy sample"
    - "3.1–3.5 starter api web canonical logging"
```

---

## OUT OF SCOPE — MIGRATION-MAP §5–§10 (§16)

```yaml
deferred_not_implemented_phase_2:
  - map_section: 5
    topic: Infra Docker
    phase_2_role: "no Docker in phase 2"
  - map_section: 7
    topic: Tenant routing production
    phase_2_role: "tenant types stub in SDK; TenantThemeProvider real phase 4"
  - map_section: 8
    topic: Plugin versioning
    phase_2_role: "theme.version aligns with plugin.version field"
  - map_section: 9
    topic: Trust marketplace
    phase_2_role: "first-party CSS only"
  - map_section: 10
    topic: Observability structured log
    phase_2_role: "no structured logging in visual packages"

phase_3_next_bridge:
  document: MIGRATION-MAP § phase 3 starter workspace + apps minimal
  sequence: "3.0 CASL → starter with theme/tokens.css under ability.can(access, WorkspaceTheme)"
```
