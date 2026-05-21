# Denali workspace provisioning

Tenant **Denali** (`subdomain: denali`) is provisioned for live **Tour Create Wizard** use at `/tours/new`.

## Reset workspace (tours + catalog; keep owner)

Deletes all Denali tours and dependencies, workspace catalog (regions, destinations, themes, equipment, presets, wizard drafts/templates), registrations/payments, and **non-owner** memberships. The `denali` tenant and canonical owner user stay.

```bash
ALLOW_DENALI_RESET=1 pnpm --filter @apps/api reset:denali
# wipe + recreate themes/presets/minimal catalog:
ALLOW_DENALI_RESET=1 pnpm --filter @apps/api reset:denali:provision
```

Production: `ALLOW_DENALI_RESET=true` (same pattern as provision).

## Primary command

```bash
pnpm --filter @apps/api provision:denali
pnpm --filter @apps/api verify:denali
```

Creates/updates:

- Tenant with `form_builder` + `finance` modules
- Six default themes (`denali_pilot` on all `denali-*` theme slugs)
- Six matching creation presets (`دنالی-*`) with `form_profile: denali_pilot`
- Workspace wizard template `base_profile: denali_pilot`
- Owner user `national_id=01234567890`, UUID `00000000-0000-4000-8000-012345678901`
- Minimal region/destination if the catalog is empty

Profile aliases (docs only — runtime uses `denali_pilot`):

| Label | Maps to |
|-------|---------|
| mountain_outdoor | `denali_pilot` |
| nature_day_trip | `denali_pilot` |
| short_sessions | `denali_pilot` |

Production requires `ALLOW_DENALI_PROVISION=true`.

## One-shot QA (provision + optional enrichment)

```bash
pnpm --filter @apps/api qa:denali:full
```

Or step by step:

```bash
pnpm --filter @apps/api qa:denali:provision
pnpm --filter @apps/api qa:denali:enrichment   # ~789 destinations + ~52 equipment rows
```

## Optional enrichment

| Script | Package command |
|--------|-----------------|
| Locations + equipment | `seed:denali-enrichment` |
| Full location catalog only | `seed:denali-locations` |
| Equipment list only | `seed:denali-equipment` |
| Sample tours (archived) | `ALLOW_DENALI_SEED=1 seed:denali-tours` |
| Legacy presets only | `seed:denali-tour-presets` |

Verify enrichment catalog: `VERIFY_DENALI_ENRICHED=1 pnpm --filter @apps/api verify:tenant -- --slug=denali`

## Web QA (real stack)

```bash
# API :3001 + web :3002 (or PW_WEB_PORT), then:
pnpm --filter @apps/web qa:integration:wizard-submit-denali
```

Set `NEXT_PUBLIC_DENALI_SIX_TAB_WIZARD=1` on the web server for production-like Denali subdomain gating.
