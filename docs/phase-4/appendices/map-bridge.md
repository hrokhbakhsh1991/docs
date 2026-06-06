## MAP BRIDGE (Appendix G)

```yaml
map_phase_4_share:
  section_5_infra: "Docker Postgres Redis root infra/"
  section_6_events: "in-process 4.5 outbox 5"
  section_7_tenant: "THIS PHASE RLS subdomain"
  section_8_plugin: "unchanged starter until 6"
  section_10_observability: "tenantId structured logs request"
interop_model: workspace-interoperability-model.md
migration_map: ../../MIGRATION-MAP.md
```

## Workspace vs tenant (MAP §1 + §7)

| MAP concept | Phase 4 doc module |
|-------------|-------------------|
| Multi-tenant boundary | 4.0–4.3, tenant-kernel, RLS |
| Workspace plugin injectable | Phase 3 — **not redefined in 4.1** |
| Three apps thin shell | 4.4 theme ingress; kernel host only |
| Denali product | Phase 6 — forbidden in 4.x |
