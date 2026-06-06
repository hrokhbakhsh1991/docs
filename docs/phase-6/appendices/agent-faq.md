# Phase 6 — Agent FAQ

## Where do I start?

[`phase-6-agent-router.md`](../phase-6-agent-router.md) → run `pnpm run phase-5:gate` → `detect_current_subphase` in BOOT-MANIFEST.

## Can I read the research doc?

Only at **T3** for architecture context. Implementation from **subphases** + DEC-P6-\*.

## Is doc guard enough for 6.9?

**No.** `phase-6:guard` is doc pack. Closure needs behavioral tests + `phase-6:gate` per [`anti-hollow-contract.md`](anti-hollow-contract.md).

## Can I import legacy?

**No** runtime import. Manual port to `packages/workspaces/denali` per DEC-P6-008.

## 6.4 blocked on Phase 5.4?

Use BLOCKER-P6-OUTBOX-5.4 waiver + stub consumer (REQ-P6-028) until 5.4 VERIFIED.

## Score?

Doc execution **96** — [`DOC-EXECUTION-SCORECARD.md`](../audits/DOC-EXECUTION-SCORECARD.md). Repo behavioral separate.
