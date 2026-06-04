# VERIFICATION COMMANDS (Appendix B)

```bash
nvm use && corepack enable
pnpm install
pnpm build
pnpm test
pnpm run guard:architecture
pnpm run guard:import-boundary
pnpm run validate-design-tokens
pnpm run guard:artifact-surface
pnpm run audit-boundary
pnpm run phase-2:guard
pnpm run phase-2:gate
rg -i denali packages/design-tokens packages/ui-primitives packages/theme-react/src
rg "design-tokens" packages/platform-core/package.json packages/platform-core/src
rg "#[0-9a-fA-F]{6}" packages/ui-primitives/src
```
