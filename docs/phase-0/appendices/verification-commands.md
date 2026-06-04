# Appendix B — Verification commands

```yaml
daily_ordered:
  - nvm use && corepack enable
  - pnpm install
  - pnpm run test:phase-0
  - pnpm run phase-0:gate
  - pnpm run baseline:metrics
  - DOC_SYNC_SCOPE=foundation pnpm run guard:doc-sync

full_integration_manual:
  - pnpm build
  - pnpm test
  - pnpm run guard:architecture
  - pnpm run guard:import-boundary

closure_minimum:
  command: pnpm run phase-0:gate
  expect: exit 0
```
