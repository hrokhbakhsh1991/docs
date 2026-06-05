# Phase 6 — CI

```yaml
phase_6_guard:
  command: pnpm run phase-6:guard
  entrypoint: scripts/guards/phase-6-guard.mjs

closure_gate:
  command: pnpm run phase-6:gate
  chain: "pnpm build && pnpm test && pnpm run phase-5:gate && pnpm run phase-6:guard"
```

**Doc validation:**

```bash
pnpm run phase-6:guard
node scripts/guards/lib/anti-hollow-phase6.mjs
```

**Note:** `phase-6:guard` proves **doc execution system ≥ 96** — not Denali product closure.
