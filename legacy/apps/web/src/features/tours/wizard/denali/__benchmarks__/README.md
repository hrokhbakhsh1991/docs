# Denali wizard performance & memory gates

Establishes and guards the Denali wizard **healthy state** for submit validation and step navigation.

## Baseline

Committed baseline: [`denali-perf-baseline.json`](./denali-perf-baseline.json) (established 2026-05-28).

| Gate | Tool | What it checks |
|------|------|----------------|
| Submit gate | [Tinybench](https://github.com/tinylibs/tinybench) | `evaluateDenaliWizardSubmitGate` mean latency (worst-case active form) |
| Wizard traversal | [Memlab](https://facebook.github.io/memlab/) | Step 1 → 7 → 1 navigation retains no detached DOM / React fibers |

## Commands

```bash
# From repo root
pnpm run bench:denali

# Or from apps/web
pnpm run bench:denali:submit-gate
pnpm run bench:denali:memlab
pnpm run bench:denali:verify   # ceiling + baseline regression + memlab
```

## CI

[`.github/workflows/denali-wizard-performance.yml`](../../../../../../.github/workflows/denali-wizard-performance.yml) runs on Denali-related PRs and `main`, enforcing:

- Mean submit-gate time &lt; **10ms** absolute ceiling
- Mean submit-gate time &lt; baseline × **1.25** regression factor
- Memlab reports **0 leaks** for wizard traversal
