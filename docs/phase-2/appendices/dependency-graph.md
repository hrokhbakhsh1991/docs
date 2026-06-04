# DEPENDENCY GRAPH (Appendix A)

## APPENDIX A — DEPENDENCY GRAPH (§17.A)

```yaml
dependency_graph_phase_2_plus:
  design-tokens:
    depends_on_packages: none
  workspace-sdk:
    depends_on_design_tokens: false
    note: "theme types + auth/ability.ts phase 3 — no CSS import"
  ui-primitives:
    depends_on: ["@app-tour/design-tokens"]
    may_peer: theme-react for ingress harness tests only
  theme-react:
    depends_on: ["@app-tour/design-tokens", "@app-tour/workspace-sdk"]
  platform-core:
    depends_on: workspace-sdk only
    forbidden: [design-tokens, ui-primitives]
    rule: "visual downstream of headless core MAP §2"
  workspaces_star:
    depends_on: [workspace-sdk, platform-core, design-tokens]
    note: "theme.css only in workspace — phase 3 starter phase 6 denali"
  apps_web:
    phase: 3
    depends_on: [theme-react, ui-primitives, platform-core, design-tokens]
```
