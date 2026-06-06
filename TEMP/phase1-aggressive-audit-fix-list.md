# باقی‌مانده — عبور فاز ۰ با DB واقعی (هدف ≥ 95)

> **به‌روز:** 2026-06-05  
> **وضعیت:** فازهای **A→E** · **F-01/F-02** · **G-01…G-06** انجام شده — این فایل **فقط کار باز** را نگه می‌دارد.

---

## انجام‌شده (خلاصه — حذف از runbook)

| بلوک              | شواهد                                                                                                 |
| ----------------- | ----------------------------------------------------------------------------------------------------- |
| A→E               | Postgres :5434 · migrate · RLS · seed · API smoke                                                     |
| F-01              | `reports/phase-0-foundation-gate-2026-06-05.json`                                                     |
| F-02              | `reports/phase-0-integration-gate-2026-06-05.json`                                                    |
| G-01…G-06         | aliases · depcruise cycles · integration JSON · doc truth · branch protection doc · `contractVersion` |
| اصلاحات تست/guard | `STORAGE_DRIVER` پیش‌فرض memory · ۹ تست trunk · `guard-forensic-storage` + provisioning               |

---

## env مشترک (قبل از هر gate)

```bash
cd /home/hamed/Music/docs
export PATH="$HOME/.nvm/versions/node/v24.16.0/bin:$PATH"
export PHASE4_DB_PORT=5434
export DATABASE_URL="postgresql://app_tour:app_tour@127.0.0.1:5434/tour_db"
export DATABASE_URL_ADMIN="postgresql://postgres:postgres@127.0.0.1:5434/tour_db"
export REDIS_URL="redis://127.0.0.1:6379"
export NODE_ENV=test
export TENANT_MAX_CONCURRENT_DB_OPS=100
export TENANT_MAX_CONCURRENT_TOUR_WRITES=100
export GLOBAL_HTTP_INFLIGHT_MAX=200
```

**قانون `STORAGE_DRIVER`:** تا F-05 unset بماند (trunk tests → memory). از F-06: `export STORAGE_DRIVER=prisma`.

---

## فاز F — نردبان gate (باقی‌مانده)

| گام      | وضعیت                              | دستور                                                                                                                         |
| -------- | ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **F-03** | ✅ PASS (`F-03 EXIT:0` 2026-06-06) | `pnpm run phase-1:gate`                                                                                                       |
| **F-04** | ⏳                                 | `pnpm run phase-2:gate`                                                                                                       |
| **F-05** | ⏳                                 | `pnpm run phase-3:gate`                                                                                                       |
| **F-06** | ⏳                                 | `export STORAGE_DRIVER=prisma` سپس `pnpm --filter @apps/api run phase-4:resilience-regression-gate` و `pnpm run phase-4:gate` |
| **F-07** | ⏳                                 | `export STORAGE_DRIVER=prisma` سپس `pnpm run test:full`                                                                       |

### اجرای یک‌جا (پس از توقف run قبلی)

```bash
# پیشنهادی — live log + توقف واقعی روی اولین FAIL (نه && با set -e)
bash scripts/ops/run-phase-f-gates.sh
# یا: tail -f TEMP/phase-f-gates.log
```

**تله bash:** `set -e` با `pnpm run phase-2:gate && echo "F-04 PASS"` **متوقف نمی‌شود** — شکست داخل `&&` استثناست. از `run-phase-f-gates.sh` استفاده کنید.

<details>
<summary>دستور legacy (بدون live log)</summary>

```bash
# همان env بالا — بدون STORAGE_DRIVER تا F-05
{
  echo "=== F ladder $(date -Iseconds) ==="
  pnpm run phase-2:gate && echo "F-04 PASS"
  ...
} > TEMP/phase-f-gates.log 2>&1
```

</details>

**لاگ زنده:** `tail -f TEMP/phase-f-gates.log`

**معیار عبور trunk:** F-02 ✅ + F-06 سبز + `ALL_F_GATES_PASS` در لاگ.

---

## فاز G — sign-off (بعد از F-07)

| گام      | کار                                                                       | شرط                |
| -------- | ------------------------------------------------------------------------- | ------------------ |
| **G-07** | به‌روز `reports/phase-0-excellence-signoff-2026-06-05.md` با امتیاز واقعی | F-07 PASS          |
| **G-08** | ماتریس rescore + `docs/phase-0/QUALITY-VALIDATION.md`                     | همه gate JSON تازه |

```bash
export STORAGE_DRIVER=prisma
pnpm run phase-0:covenant-gate
pnpm run phase-0:trunk-gate
pnpm run phase-4:gate
DOC_SYNC_SCOPE=foundation pnpm run guard:doc-sync
pnpm run baseline:metrics
```

**Sign-off ≥95:** فقط وقتی `reports/phase-4-gate-*.json` پس از F-06 و `ALL_F_GATES_PASS` موجود باشد.

---

## عیب‌یابی سریع (gate)

| علامت                          | اقدام                                                                                                |
| ------------------------------ | ---------------------------------------------------------------------------------------------------- |
| `POST /tours` → 500 در trunk   | `STORAGE_DRIVER` نباید prisma باشد تا F-05                                                           |
| `guard-forensic-storage` FAIL  | allow-list: `provisioning.service.ts` (DEC-127)                                                      |
| تست‌های observability بدون log | `drainHttpRequestLogQueueSync()` بعد از HTTP                                                         |
| flood 100-tenant → 503         | `GLOBAL_HTTP_INFLIGHT_MAX≥132`                                                                       |
| outbox throughput < 80/s       | `MIN_THROUGHPUT` پیش‌فرض 80 در spec                                                                  |
| gate روی chaos قفل می‌شود      | worker یتیم `atomic-crash-worker` — `pkill -9 -f atomic-crash-worker`؛ trunk دیگر chaos اجرا نمی‌کند |
| gate «قفل» ولی لاگ نمی‌رود     | چند run موازی — `pgrep -af phase-1:gate`؛ فقط یکی بماند. outbox throughput ~۸۰s طبیعی است            |
| `service-starvation` heartbeat | آستانه `STARVATION_MAX_HEARTBEAT_GAP_MS` پیش‌فرض 260 (تحت بار full suite)                            |

---

## پیوندها

- [`docs/dev/tiered-testing.md`](../docs/dev/tiered-testing.md) — `STORAGE_DRIVER` پیش‌فرض
- [`docs/phase-4/ci.md`](../docs/phase-4/ci.md) — CI env
- [`reports/phase-0-excellence-signoff-2026-06-05.md`](../reports/phase-0-excellence-signoff-2026-06-05.md) — **منتظر F-07 برای تأیید نهایی**
