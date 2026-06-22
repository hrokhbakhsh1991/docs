# P7-2 — Tour workspace Denali (additive ops)

```yaml
epic: P7-2
status: PLANNED
priority: 3
prerequisite: P7-1 (publish path green)
zone: Z3 additive
estimate_nanos: TBD
```

## Goal

اپراتور روی **همان تور مشتری** کار روز اول را کند — workspace موجود را پایدار کن؛ فقط قابلیت‌های **ضروری** اضافه کن.

## Reality (trunk)

مسیرهای موجود:

```text
/tours/[id]/workspace           → registrations (command center embed)
/tours/[id]/workspace/waitlist  → waitlist promote
/tours/[id]/workspace/transport → transport roster
```

این **نه صفر است** — ولی برای مشتری اول ممکن است ناقص یا brittle باشد.

## Scope

| In (P0 ops) | Out (Z4) |
| ----------- | -------- |
| approve booking از workspace/CC | finance per-tour tab جدید |
| waitlist → approve | documents workspace |
| transport list درست برای تور واقعی | leader tools عمقی |
| link به `/finance` برای receipt | dashboard redesign |

## Work packages (بسط بعدی → nanos)

1. **Registrations tab** — `tourId` preset · pending از portal registration
2. **Waitlist promote** — end-to-end روی staging
3. **Transport** — modes از canonical tour
4. **Operator register** — `(app)/tours/[id]/register` اگر روز اول لازم

## FORBIDDEN

```text
❌ Refactor (app)/ admin shell
❌ Merge workspace logic into wizard package
❌ New workspace tabs without P0 justification
```

## Exit signal

VS-06 live: اپراتور booking portal را از workspace تأیید می‌کند.

## References

- [p6-2-operator-admin.md](../../phase-19/p6/p6-2-operator-admin.md)
- [first-customer-operator.md](../../phase-19/p6/runbooks/first-customer-operator.md)
