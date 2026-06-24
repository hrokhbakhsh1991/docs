# P8 — Deprecated entrypoints (do not boot here)

```yaml
doc_id: P8-DEPRECATED-ENTRYPOINTS
pack_version: "1.0"
sole_entry: docs/phase-21/AGENT-START.md
boot_manifest: appendices/P8-BOOT-MANIFEST.yaml
```

> Agents must **not** use these as sole boot. Redirect to [AGENT-START.md](../AGENT-START.md).

---

## Deprecated paths

| Path | Why deprecated | Use instead |
| ---- | -------------- | ----------- |
| `p8-ingress-session-env-audit.md` alone | Audit has no per-nano verify keys | BOOT-MANIFEST + VERIFICATION-COMMANDS |
| `p8-action-plan.yaml` alone | Waves without proof tiers | current nano in VERIFICATION-COMMANDS |
| `platform-surface-hardening.mdoc` alone | Charter umbrella | AGENT-START T0 |
| `POST-P7-PLATFORM-ROADMAP.md` | Multi-pack overview | P8-BOOT-MANIFEST |
| `phase-22/*` / `phase-23/*` | Wrong pack | Wait for P8 exit |
| Bulk-read all gap registry | Scope creep | current nano only |

---

## Deprecated actions (scope leak)

| Action | Owner pack |
| ------ | ---------- |
| Create `packages/guest-surface-host` | P9 |
| Remove web public-auth routes | P9 |
| Add `deploy/vps/caddy/` | P10 |
| Admin custom apex ingress | trunk v2 / P10+ |
| `__Host-` session cookies | P10 HTTPS |

Booting from deprecated path → `hollow_risk: flagged` in turn report.
