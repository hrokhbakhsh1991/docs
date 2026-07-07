# Post-P7 — Effort ranking: کدام pack بیشتر کار دارد؟

```yaml
doc_id: POST-P7-EFFORT-RANKING
version: "1.1"
date: 2026-06-22
alignment: POST-P7-PACK-ALIGNMENT.md
verdict: P10_max_effort_to_nine
```

> **خلاصه:** برای platform multi-club · **P10 بیشترین کار** را دارد.  
> Exit scores هم‌تراز: [POST-P7-PACK-ALIGNMENT.md](POST-P7-PACK-ALIGNMENT.md)

---

## جدول مقایسه (fit-aligned)

| | **P8** | **P9** | **P10** |
| --- | --- | --- | --- |
| **baseline composite** | 3.2 | 3.2 | 3.4 |
| **هدف exit (fit)** | A≥9 · B≥8 · env≥9 | **≥8.7** | **≥8.7** |
| **بعد exit (سخت)** | ~8.0 | ~8.7 | ~8.7 |
| **فاصله تا ۱۰** | ~1.2 | ~0.8 | ~0.8–1.0 |
| **نوع کار** | patch app code | packages + delete | infra greenfield |
| **هفته (تخمین)** | 2–4 | 3–5 | **5–10** |
| **رتبه کار** | 🥈 دوم | 🥉 سوم | **🥇 اول** |

---

## مسیر تجمعی

| بعد از | platform کلی | apex HTTPS |
| ------ | -----------: | ---------: |
| P7 | ~6.5 | ~3.4 |
| P8 | ~7.5–8.0 | ~4.5 |
| P9 | ~8.5 | ~5.0 |
| P10 | **~8.8–9.0** | **~8.7–9.0** |

---

## کدام را اول؟

1. **P8** — cookie/env/ingress  
2. **P9** — web BFF duplicate  
3. **P10** — فقط وقتی P8≥8 و P9≥8.5

---

## References

- [POST-P7-PACK-ALIGNMENT.md](POST-P7-PACK-ALIGNMENT.md)
- [POST-P7-PLATFORM-ROADMAP.md](POST-P7-PLATFORM-ROADMAP.md)
- [phase-23/p10-effort-to-nine.md](phase-23/p10-effort-to-nine.md)
