# Agent execution contract — DEPRECATED

> **STATUS:** DEPRECATED 2026-06-04 hardening — **do not boot from this file.**  
> **SOLE EXECUTION ENTRY:** [`../phase-5-agent-router.md`](../phase-5-agent-router.md)  
> **Authoritative boot:** [`BOOT-MANIFEST.yaml`](BOOT-MANIFEST.yaml) · **Forbidden paths:** [`DEPRECATED-ENTRYPOINTS.md`](DEPRECATED-ENTRYPOINTS.md)

```yaml
agent_execution_contract:
  status: DEPRECATED
  redirect: ../phase-5-agent-router.md
  boot_manifest: BOOT-MANIFEST.yaml
  fail_if_used_as_sole_entry: FAIL
```

All prior `required_read_first` (research monolith, `phase-5-ai-exec.md` initiator) are **revoked**. Use router `AGENT_START_SEQUENCE` only.
