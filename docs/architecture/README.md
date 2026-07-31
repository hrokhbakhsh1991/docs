# Platform architecture (docs)

Authoritative architecture documents for cross-cutting platform capabilities.

**Active registry (PSR-2a):** [`docs/index.yaml`](../index.yaml) — machine list of
active authority. Schema: [`DOC-META-001`](../standards/doc-authority-metadata.schema.mdoc).

| Document | Scope |
| --- | --- |
| [Platform simplification remediation](./platform-simplification-remediation.mdoc) | PSR-001 program SoT |
| [Field Exposure System](./field-exposure-system.md) | Surface, audience, trigger, profiles, intents, exposure resolver. **Phase 0 complete. Phase 1 complete. Phase 2 complete. Phase 3 complete. Phase 4 complete. Phase 5 complete. Phase 6 complete. Phase 7 complete. Phase 8 complete.** Enterprise milestones M1–M4 documented in the same doc. |
| [Field Policy System](./field-policy-system.md) | Entity/workspace field state (PDP); separate from exposure/publication. |
| [Denali Gravity remediation](./denali-gravity-remediation.mdoc) | Path B: stop second-product clone forests — P-contract/P-lib, maturity ladder G0–G3, DG-0…DG-6 (+ optional DG-F). Detailed map: [`denali-gravity-remediation-map.mdoc`](./denali-gravity-remediation-map.mdoc). |
| [Denali Gravity — Product Profile example](./denali-gravity-product-profile.example.mdoc) | DG-2.2: C-only G1 deltas + thin W adapter budget for product #2 (fictional `harbor`); anchors guest-club/starter/urban. |

Verification:

- Phase 0 (freeze + inventory): `pnpm run guard:field-exposure-phase-0`
- Phase 1 (domain language): `pnpm run guard:field-exposure-phase-1`
- Phase 2 (read-path adapter): `pnpm run guard:field-exposure-phase-2`
- Phase 3 (shadow resolver): `pnpm run guard:field-exposure-phase-3`
- Phase 4 (exposure profiles): `pnpm run guard:field-exposure-phase-4`
- Phase 5 (generic exposure UI): `pnpm run guard:field-exposure-phase-5`
- Phase 6 (dual-write + controlled cutover): `pnpm run guard:field-exposure-phase-6`
- Phase 7 (remove integration-owned selection): `pnpm run guard:field-exposure-phase-7`
- Phase 8 (enterprise hardening): `pnpm run guard:field-exposure-phase-8`
- Phase 9 (runtime safety — M2): `pnpm run guard:field-exposure-phase-9`
- Phase 10 (Denali product + enterprise ops — M3/M4): `pnpm run guard:field-exposure-phase-10`
- Phase 11 (platform exposure plugin — M5): `pnpm run guard:field-exposure-phase-11`
