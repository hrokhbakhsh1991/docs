# Legacy — Tour Ops monorepo (pre–app-tour)

Everything that lived at the repository root before the **app-tour** greenfield lives here.

## Contents

- Full monorepo: `apps/`, `packages/`, `infra/`, `scripts/`, migration docs (`map.md`, `phase-0-platform-baseline.md`, …)
- Denali-coupled wizard, API strategies, and partial Phase 1 `workspace-sdk` (under `legacy/packages/workspace-sdk`)

## Do not develop new platform features here

New work happens at the repo root (`app-tour`). Use this tree only for:

- Reference implementations (tenant RLS, denali-domain registry, smoke specs)
- Porting data or code into `packages/workspaces/denali` later

## Run the old stack (if needed)

```bash
cd legacy
nvm use
corepack enable
pnpm install
# see legacy/AGENTS.md and legacy/README.md
```
