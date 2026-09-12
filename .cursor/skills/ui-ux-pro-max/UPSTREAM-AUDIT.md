# UI UX Pro Max — upstream audit (FDA-001)

**Audit date:** 2026-09-04  
**Auditor:** Feature Delivery Agent (documentation-only integration)

## Source

| Field | Value |
| ----- | ----- |
| **Upstream URL** | https://github.com/nextlevelbuilder/ui-ux-pro-max-skill |
| **License** | MIT (Copyright 2024 Next Level Builder) |
| **Upstream commit (main, audited)** | `f3ac195224eac1eb0dfe1a3059c2a6add78ffbe3` |
| **Integration mode** | **Vendored** — minimal portable copy under `.cursor/skills/ui-ux-pro-max/` |

## Vendored files (local)

| Path | Purpose |
| ---- | ------- |
| `SKILL.md` | Skill instructions and search workflow |
| `scripts/search.py` | CLI entry — BM25 search over CSV data |
| `scripts/core.py` | Search engine (local CSV only) |
| `scripts/design_system.py` | Design-system aggregation |
| `data/*.csv` | Style, color, typography, UX guideline databases |
| `data/stacks/*.csv` | Stack-specific guidance (incl. `nextjs`, `shadcn`, `react`) |
| `FDA-INTEGRATION.md` | app-tour FDA adapter, detection, fallback checklist |
| `UPSTREAM-AUDIT.md` | This audit record |

**Not vendored:** upstream `cli/`, `uipro init` installers, npm packages, remote install scripts.

## Security review

| Check | Result |
| ----- | ------ |
| Remote script execution during FDA workflow | **Forbidden** — do not run `curl \| bash` or `uipro init` without separate review |
| `search.py` network access | **None** — reads local CSV under `data/` only |
| `core.py` network access | **None** |
| `design_system.py` | Writes optional `design-system/` under cwd when `--persist` used — **not used in FDA workflow** |
| `data/_sync_all.py` | Upstream data sync — **do not run** in FDA sessions |
| Python dependency | Stdlib only (`csv`, `pathlib`, `argparse`) — no pip install required |
| Executable setup | `python3 .cursor/skills/ui-ux-pro-max/scripts/search.py` — reviewed, local-only |

## Cursor compatibility

- Skill format: Cursor `SKILL.md` + local scripts (matches upstream pattern).
- FDA invokes via **Read skill** + **shell search command** — no Cursor marketplace dependency.
- When skill files missing → fallback per [`FDA-INTEGRATION.md`](FDA-INTEGRATION.md).

## Portability limitations

- Requires `python3` on PATH for search commands.
- Vendored data may lag upstream `main`; record upstream commit when refreshing vendor copy.
- Recommendations are **advisory** — Denali tokens, design-system specs, product requirements, RTL/LTR, and accessibility always override.

## Refresh procedure (maintainers)

1. Review upstream `LICENSE`, `SKILL.md`, `scripts/`, `data/` diff.
2. Copy only `SKILL.md`, `scripts/`, `data/` (exclude `cli/`, install scripts).
3. Update **Upstream commit** in this file.
4. Run `python3 scripts/search.py "test" --domain ux` locally to verify.
5. Commit with note: `chore(skills): refresh ui-ux-pro-max vendor @<sha>`.

---

_MIT license permits vendoring with copyright notice preserved in upstream LICENSE (not duplicated here — see upstream repo)._
