# License / publication model — decision memo (TEMPLATE — not binding)

Status: **draft for Architect + counsel**
Wave: PSR-8c0
Do not copy to repo root until PSR-8c1.

## Options (pick one)

1. **Full open source** — single permissive or copyleft LICENSE at root; all
   active packages inherit.
2. **Open core** — SDK / platform contracts / starter open; Denali/ops/product
   remain private (separate LICENSE or UNLICENSED).
3. **Source-available** — public read with restricted commercial terms.

## Checklist before root landing

- [ ] Counsel review complete
- [ ] Package `license` fields updated (replace `UNLICENSED` where appropriate)
- [ ] Publication boundary scrub (absolute paths, private domains, secrets)
- [ ] `legacy/` excluded from public tree
- [ ] SECURITY.md + CONTRIBUTING.md landed with LICENSE

## Provisional SPDX candidates (counsel chooses)

- Apache-2.0
- MIT
- BUSL-1.1 / other source-available (if option 3)

Selected: _TBD_
