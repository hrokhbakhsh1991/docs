# CW6-04 — `workspace:create --profile` scaffold path

**Verdict:** Implementation  
**Ledger task:** CW6-04  
**Status:** Guest L3 scaffold accepts `--profile <id>` with catalog validation  
**Prepared:** 2026-08-23

---

## Usage

```bash
pnpm run workspace:create -- outdoor-club --profile starter-outdoor
```

`--profile` implies guest L3 scaffold and writes `profile` on author manifest. Codegen expands profile defaults via CW6-02.

## Tests

| Spec | Coverage |
| ---- | -------- |
| `workspace-create-profile.spec.mjs` | flag parsing, PROFILE_NOT_FOUND, manifest + expansion |

---

*Architect, documentation status: Updated. Link to docs: `docs/dev/cw6-04-workspace-create-profile.md`.*
