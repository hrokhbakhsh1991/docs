# Denali workspace provisioning

Tenant **Denali** (`subdomain: denali`) is provisioned for live **Tour Create Wizard** use at `/tours/new`.

## Primary command

```bash
pnpm --filter @apps/api provision:denali
pnpm --filter @apps/api verify:denali
```

Creates/updates:

- Tenant with `form_builder` + `finance` modules
- Six default themes (`mountain_outdoor`, `nature_trip`, `cinema_event` for short sessions)
- Six matching creation presets (`دنالی-*`)
- Owner user `national_id=01234567890`, UUID `00000000-0000-4000-8000-012345678901`
- Minimal region/destination if the catalog is empty

Profile aliases (product language → code):

| Label | `TourFormProfile` |
|-------|-------------------|
| mountain_outdoor | `mountain_outdoor` |
| nature_day_trip | `nature_trip` |
| short_sessions | `cinema_event` |

Production requires `ALLOW_DENALI_PROVISION=true`.

## Optional enrichment (archived tour/location seeds)

| Script | Package command |
|--------|-----------------|
| Full location catalog | `seed:denali-locations` |
| Sample tours | `seed:denali-tours` |
| Equipment list | `seed:denali-equipment` |
| Legacy presets only | `seed:denali-tour-presets` |

Tour/location/equipment seeds require `ALLOW_DENALI_SEED=1` where noted in each script.
