# Appendix A — Dependency graph

## APPENDIX A — DEPENDENCY GRAPH (§18.A)

```yaml
dependency_graph_phase_3:
  design-tokens:
    depends_on: none
  workspace-sdk:
    depends_on: none
    phase_3_addition: "auth/ability.ts + casl/defineAbilityFor"
  ui-primitives:
    depends_on: [design-tokens]
    rule: subpaths only
  theme-react:
    depends_on: [design-tokens, workspace-sdk]
  platform-core:
    depends_on: [workspace-sdk]
    forbidden: [design-tokens, ui-primitives]
  workspaces/starter:
    depends_on: [workspace-sdk, platform-core, design-tokens]
    forbidden: [ui-primitives, apps]
  apps/web:
    depends_on: [theme-react, ui-primitives subpaths, workspace-sdk, platform-core, workspace-starter]
    forbidden: [static workspaces/*]
  apps/api:
    depends_on: [workspace-sdk, platform-core, workspace-starter validation]
    forbidden: [ui-primitives, denali]
    note: "@casl/prisma phase 4+"
```

---

