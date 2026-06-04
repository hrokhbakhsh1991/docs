# Appendix B — Verification commands

```bash
nvm use && corepack enable
pnpm install
pnpm build
pnpm test
pnpm run guard:architecture
pnpm run guard:import-boundary
pnpm run guard:artifact-surface
pnpm run audit-boundary
pnpm run phase-2:gate
pnpm run doc-gate
pnpm run phase-3:gate
pnpm --filter @apps/web run lint
pnpm --filter @apps/api run phase-3:api-gate
pnpm --filter @apps/web run phase-3:web-gate
```

---

