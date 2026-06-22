# P7-1 — Wizard & settings completion (protect zone)

```yaml
epic: P7-1
status: PLANNED
priority: 2
prerequisite: P7-0
zone: Z1 freeze + Z2 complete
estimate_nanos: TBD
```

## Goal

**تکمیل آنچه در wizard/settings هست** — تور واقعی مشتری قابل ساخت، save، publish (`active`) بدون rebuild.

## Reality (trunk)

| Asset | وضعیت |
| ----- | ----- |
| `/tours/new` + Denali composites | پیاده · سنگین |
| rules · `denaliRuleModel` | پیاده — **دست نزن** |
| settings modules (equipment, locations, …) | بیشتر trunk — audit blocker |
| شرایط / terms در canonical | پیاده — verify روی تور واقعی |

## Scope

| In (Z2) | Out (Z4/Later) |
| ------- | -------------- |
| blocker save/validate/publish | redesign UI |
| terms/conditions روی تور واقعی | settings module جدید |
| wizard spec regression green | framer-motion polish |
| flat edit `/tours/[id]/edit` اگر blocker | urban workspace |

## Work packages (بسط بعدی → nanos)

1. **Walkthrough blocker list** — یک تور واقعی مشتری از اول تا publish
2. **Fix P0 blockers only** — هر باگی که publish یا intake را می‌شکند
3. **Settings seed** — داده لازم برای wizard prefill مشتری
4. **Preservation** — `p6:gate` + wizard specs هر PR

## FORBIDDEN

```text
❌ Move wizard into (app)/
❌ Delete/refactor denali rules/composites
❌ New wizard framework
```

## Exit signal

VS-01 live: تور مشتری `publishStatus: active` روی staging.

## References

- [wizard-experience.md](../../workspaces/denali/wizard-experience.md)
- [p6-denali-safety.md](../../phase-19/p6/p6-denali-safety.md)
