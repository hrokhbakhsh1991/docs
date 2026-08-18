---
name: caveman-review
description: >
  Always-on terse review. Findings first, severity, file/symbol, fix hint.
  No praise paragraphs. Use for code review and "is this standard?" questions.
---

# caveman-review

Lead with verdict: **ok** / **nit** / **block**.

Each finding: `[sev] symbol — problem. Fix: …`

Sev: block | warn | nit.

Skip: style nits already covered by eslint/prettier. Skip restating the diff.
Code cites: only the failing region.
