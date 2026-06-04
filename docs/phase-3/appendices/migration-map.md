# Appendix — MIGRATION-MAP bridge

## MIGRATION-MAP BRIDGE §4–§10 (§17)

```yaml
map_bridge_phase_3_contribution:
  - map_section: 4
    topic: WorkspacePlugin
    phase_3: "starter implements"
  - map_section: 5
    topic: Infra
    phase_3: "Docker Postgres/Redis local dev; API tour SoT in-memory until Phase 4 RLS"
  - map_section: 6
    topic: Events
    phase_3: "hook points only — full bus phase 4-5"
  - map_section: 7
    topic: Tenant
    phase_3: "CASL now; RLS phase 4"
  - map_section: 8
    topic: Plugin lifecycle
    phase_3: "contractVersion on starter"
  - map_section: 10
    topic: Observability
    phase_3: "3.5 baseline pino health phase-3-guard report"
phase_4_next:
  - tenant-kernel
  - TenantThemeProvider production
  - RLS
```

---

