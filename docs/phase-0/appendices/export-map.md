# Appendix C — Export map

### Appendix C — export map requirements

```yaml
exports_from_index_ts:
  - WORKSPACE_SDK_VERSION
  - CanonicalDocument helpers
  - starterWorkspacePlugin
  - WorkspacePlugin isWorkspacePlugin
  - WorkspaceTypeId STARTER_WORKSPACE_TYPE
  - resolveWorkspacePluginIdForType
  - registry rule wizard validation lifecycle types
  - auth/* CASL defineAbilityFor createTenantAbility canAccessWorkspaceTheme
  - theme/* WorkspaceThemeContract presets snapshotWorkspaceTheme ingress helpers
  - ingress/* parseCanonicalDocumentFromStorage parseWorkspacePluginFromStorage
verify: "dist-surface contract in test/contract.spec.ts"
```

