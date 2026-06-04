## DEPENDENCY GRAPH (Appendix A)

```yaml
dependency_graph:
  design-tokens: []
  workspace-sdk: ["@casl/ability"]
  platform-core: ["workspace-sdk"]
  ui-primitives: ["design-tokens"]
  theme-react: ["design-tokens", "workspace-sdk"]
  tenant-kernel: ["workspace-sdk optional types"]
  platform-events: []
  workspaces/starter: ["workspace-sdk", "platform-core", "design-tokens"]
  apps/api: ["tenant-kernel", "platform-events", "workspace-sdk", "platform-core", "workspace-starter"]
  apps/web: ["theme-react", "ui-primitives/*", "workspace-sdk", "platform-core", "design-tokens"]
  forbidden_edges:
    - "apps/web → workspaces/* static"
    - "platform-core → tenant-kernel"
    - "platform-core → design-tokens"
```
