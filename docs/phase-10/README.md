# Phase 10 — Workspace Host (Plugin-Native Platform)

> **وضعیت:** فاز ۱–۷ DONE (2026-06-08) · charter: [`phase-10-charter.md`](phase-10-charter.md)  
> **هدف:** تبدیل trunk از Product-Aware به Plugin Host — **بدون** تغییر `packages/platform-core`  
> **منبع اجرا:** [`TEMP/platform-plugin-native-remediation-roadmap.md`](../../TEMP/platform-plugin-native-remediation-roadmap.md)

## سندهای این فاز

| سند | نقش |
| --- | --- |
| [`workspace-host-contract-v2.md`](workspace-host-contract-v2.md) | RFC اصلی — manifest، migration، بازخوانی فاز ۰ |
| [`subphases/10.1-outbox-side-effects.md`](subphases/10.1-outbox-side-effects.md) | فاز ۱ — dispatcher (DEC-P10-002) DONE |
| [`subphases/10.2-manifest-codegen.md`](subphases/10.2-manifest-codegen.md) | فاز ۲ — manifest + codegen (DEC-P10-001) DONE |
| [`subphases/10.3-http-route-registrar.md`](subphases/10.3-http-route-registrar.md) | فاز ۳ — HTTP registrar urban pilot DONE |
| [`subphases/10.4-finance-registrar.md`](subphases/10.4-finance-registrar.md) | فاز ۴ — finance registrar + package move + web loader |
| [`subphases/10.5-sdk-neutral.md`](subphases/10.5-sdk-neutral.md) | فاز ۵ — SDK product-neutral auth + bindings |
| [`subphases/10.6-data-layer-policy.md`](subphases/10.6-data-layer-policy.md) | فاز ۶ — DEC schema ownership (no migration) |
| [`phase-10-charter.md`](phase-10-charter.md) | charter + 9.5+ acceptance matrix |
| [`appendices/WORKSPACE-MANIFEST.schema.json`](appendices/WORKSPACE-MANIFEST.schema.json) | JSON Schema رسمی manifest |
| [`appendices/IMPLEMENTATION-DECISIONS.md`](appendices/IMPLEMENTATION-DECISIONS.md) | DEC-P10-001 (codegen policy) |
| [`appendices/MIGRATION-MAP-PLUGIN-HOST.md`](appendices/MIGRATION-MAP-PLUGIN-HOST.md) | جدول فایل قدیم → جدید + shim |
| [`appendices/SPEC-PRESERVATION-MATRIX.md`](appendices/SPEC-PRESERVATION-MATRIX.md) | specهایی که نباید در فاز ۱–۳ بشکنند |

## پیش‌نیاز

- Phase 6–9 workspace plugins (starter, denali, urban) green
- `docs/phase-3/phase-3-deferred-capabilities.md` — GAP-3.3-04

## قانون اجرا

**فاز ۰ = doc فقط.** هیچ تغییر runtime در `apps/api` / `workspace-sdk` تا تأیید DEC-P10-001 و اتمام P0-T05.

## گام بعدی

per-tenant `enabledPlugins` (P7-T07 advanced) · denali-finance shim removal (mirror P3-T11)
