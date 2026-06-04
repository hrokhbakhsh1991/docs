# Appendix C — Verification commands

```bash
nvm use && corepack enable
pnpm install
pnpm --filter @app-tour/platform-core build
pnpm --filter @app-tour/platform-core test
pnpm --filter @app-tour/platform-core run test:phase-1
pnpm run phase-1:gate
pnpm run guard:architecture
pnpm run guard:import-boundary
pnpm run guard:symlink
rg -i denali packages/platform-core -g '!**/*.spec.ts'
rg react packages/platform-core
```

