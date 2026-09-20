# Denali — QA Bug Ledger و برنامه رفع

> این فایل منبع اصلی اجراست. هر ردیف یک تسک مستقل است؛ هیچ عامل یا توسعه‌دهنده‌ای حق ندارد چند ردیف را با یک «انجام شد» ببندد.

## قواعد اجباری

هر تسک باید چهار مرحله را طی کند:

1. **Reproduce:** محیط، workspace، نقش، URL و fixture را ثبت کن.
2. **Diagnose:** source، request/response، log و console را بررسی کن؛ حدس علت نیست.
3. **Fix:** کوچک‌ترین اصلاح را در مالک صحیح انجام بده.
4. **Prove:** تست مناسب و evidence با SHA جاری ثبت کن.

وضعیت‌ها:

- `OPEN`: finding بازتولیدشده.
- `NOT_TESTED`: هنوز اجرا نشده؛ باگ قطعی نیست.
- `BLOCKED`: به fixture/دسترسی/سرویس بیرونی نیاز دارد.
- `FIXED_LOCALLY`: اصلاح محلی دارد، اما runtime proof لازم است.
- `PASS`: تست و evidence کامل.

قانون release: از workflow قدیمی، SHA قدیمی، test message یا CI pending نتیجه deploy/merge نگیر.

## 1. یافته‌های قطعی یا بازتولیدشده

| ID | اولویت | وضعیت | یافته | معیار بسته‌شدن |
|---|---|---|---|---|
| DENALI-001 | P1 | OPEN | تب transport roster پیام unavailable می‌دهد؛ علت API هنوز ثبت نشده. | status پاسخ، log علت، fixture سالم و دو load موفق. |
| DENALI-002 | P2 | OPEN | React hydration error `#418` در transport route. | build تمیز و دو navigation بدون console error. |
| DENALI-003 | P2 | OPEN | `bookings.status.actionable` در fa ناقص و در UI خام نمایش داده می‌شود. | fa/en label معتبر و تست locale completeness سبز. |
| DENALI-004 | P2 | OPEN | route ناشناخته Admin به generic 500 می‌رسد، نه 404. | 404 استاندارد، بدون stack داخلی. |
| DENALI-005 | P1 | OPEN | debug host endpoint برای anonymous قابل‌مشاهده است. | حذف یا auth/allowlist و تست anonymous. |
| DENALI-006 | P1 | OPEN | unknown Marketing host به catalog API پاسخ 500 کنترل‌نشده می‌دهد. | 4xx کنترل‌شده و بدون tenant fallback. |
| DENALI-007 | P1 | OPEN | unknown Portal route/API به generic 500 می‌رسد. | 404/400 قراردادشده و بدون stack. |
| DENALI-008 | P0 | OPEN | tenant resolution به forwarded-host قابل‌دسترس از client اعتماد می‌کند. | spoof دو tenant رد شود و proxy trusted اثبات شود. |
| DENALI-AUTH-001 | P2 | BLOCKED | fixture رسمی login محلی با فرم پذیرفته نشد؛ bypass ممنوع است. | identity رسمی پذیرفته یا قرارداد fixture اصلاح شود. |

## 2. تسک‌های قابل‌اجرا

ستون آخر عمداً وضعیت فعلی را نشان می‌دهد؛ پس از اجرا باید با evidence به‌روزرسانی شود.

### A — خط مبنا، محیط و امنیت (QA-001 تا QA-016)

| ID | Pri | اقدام | معیار قبولی | وضعیت |
|---|---|---|---|---|
| QA-001 | P0 | SHA branch، base، deploy و env را ثبت کن. | همه evidenceها به یک SHA اشاره کنند. | NOT_TESTED |
| QA-002 | P0 | health API/Admin/Marketing/Portal را بررسی کن. | هر چهار surface پاسخ مورد انتظار. | NOT_TESTED |
| QA-003 | P0 | tenant A و B fixture بساز یا تأیید کن. | داده‌ها کاملاً جدا. | NOT_TESTED |
| QA-004 | P1 | migration head و pending migration را بررسی کن. | head جاری و بدون pending. | NOT_TESTED |
| QA-005 | P1 | console/network baseline هر surface را ذخیره کن. | baseline با خطای جدید قاطی نشود. | NOT_TESTED |
| QA-006 | P1 | production build تمیز و asset manifest را بررسی کن. | asset و source SHA هماهنگ. | NOT_TESTED |
| QA-007 | P1 | ماتریس route/role/workspace ایجاد کن. | هیچ مسیر تستی بدون owner نباشد. | NOT_TESTED |
| QA-008 | P1 | fixture cleanup را dry-run کن. | فقط داده تست پاک شود. | NOT_TESTED |
| QA-009 | P0 | anonymous Admin protected routes را بزن. | redirect/login، بدون private HTML. | NOT_TESTED |
| QA-010 | P0 | anonymous Portal protected routes/API را بزن. | 401/redirect، نه 500. | OPEN (DENALI-007) |
| QA-011 | P0 | anonymous Marketing/public-private split را بزن. | catalog عمومی، عملیات private. | NOT_TESTED |
| QA-012 | P0 | unknown host هر سه surface را تست کن. | 4xx کنترل‌شده. | OPEN (006/007) |
| QA-013 | P0 | forwarded-host spoof را با دو tenant اجرا کن. | tenant جعلی انتخاب نشود. | OPEN (008) |
| QA-014 | P1 | cookie domain/path/secure را بررسی کن. | session leakage و loop نباشد. | NOT_TESTED |
| QA-015 | P1 | debug endpointها را anonymous و authenticated مقایسه کن. | secret/stack/debug data عمومی نباشد. | OPEN (005) |
| QA-016 | P1 | unknown Admin route را با browser و HTTP مقایسه کن. | هر دو 404 استاندارد. | OPEN (004) |

### B — login و session (QA-017 تا QA-025)

| ID | Pri | اقدام | معیار قبولی | وضعیت |
|---|---|---|---|---|
| QA-017 | P1 | login با identity رسمی و OTP معتبر. | dashboard و session ساخته شود. | BLOCKED (AUTH-001) |
| QA-018 | P1 | OTP غلط. | رد شود؛ session ساخته نشود. | NOT_TESTED |
| QA-019 | P1 | OTP منقضی/مصرف‌شده. | replay ممکن نباشد. | NOT_TESTED |
| QA-020 | P1 | refresh و تب جدید بعد از login. | session و tenant حفظ شود. | NOT_TESTED |
| QA-021 | P1 | logout و refresh route محافظت‌شده. | redirect login و عدم نمایش private data. | NOT_TESTED |
| QA-022 | P0 | suspend یا role change و token قدیمی. | session-version invalidation. | NOT_TESTED |
| QA-023 | P1 | نقش owner/admin/member/viewer روی routeها. | capability دقیق هر نقش. | NOT_TESTED |
| QA-024 | P1 | return URL از login به Portal register. | مسیر حفظ و open redirect بسته. | NOT_TESTED |
| QA-025 | P1 | timeout API در login/register. | retry امن و پیام قابل‌فهم. | NOT_TESTED |

### C — ساخت و چرخه عمر تور (QA-026 تا QA-040)

| ID | Pri | اقدام | معیار قبولی | وضعیت |
|---|---|---|---|---|
| QA-026 | P1 | ساخت draft با حداقل فیلدها. | فقط Admin و status=draft. | NOT_TESTED |
| QA-027 | P1 | ساخت تور کامل با media. | refresh بدون از دست رفتن داده. | NOT_TESTED |
| QA-028 | P2 | ذخیره مرحله‌ای wizard و refresh. | canonical document حفظ شود. | NOT_TESTED |
| QA-029 | P1 | تاریخ پایان قبل از شروع. | UI و API هر دو reject. | NOT_TESTED |
| QA-030 | P1 | ظرفیت صفر/منفی/بیش از سقف. | rule واحد در UI/API. | NOT_TESTED |
| QA-031 | P1 | قیمت صفر/اعشاری/منفی. | currency و حداقل مبلغ enforce. | NOT_TESTED |
| QA-032 | P1 | draft/unpublished در Marketing. | عمومی دیده نشود. | NOT_TESTED |
| QA-033 | P1 | publish تور کامل. | فقط پس از publish در catalog. | NOT_TESTED |
| QA-034 | P1 | unpublish/archive. | CTA بسته و پیام درست. | NOT_TESTED |
| QA-035 | P1 | edit تور منتشرشده. | updatedAt واقعی تغییر و createdAt ثابت. | FIXED_LOCALLY |
| QA-036 | P1 | double-click save/publish. | یک mutation و event. | NOT_TESTED |
| QA-037 | P1 | دو ویرایشگر هم‌زمان. | conflict قابل‌فهم؛ overwrite خاموش ممنوع. | NOT_TESTED |
| QA-038 | P2 | clone تور. | شناسه، رزرو و پرداخت کپی نشود. | NOT_TESTED |
| QA-039 | P2 | حذف draft و back/refresh. | فقط draft مجاز حذف شود. | NOT_TESTED |
| QA-040 | P2 | `updatedAt` در list/detail/API یکسان. | هیچ تاریخ 1348 یا createdAt جعلی. | FIXED_LOCALLY |

### D — Marketing و رسانه (QA-041 تا QA-051)

| ID | Pri | اقدام | معیار قبولی | وضعیت |
|---|---|---|---|---|
| QA-041 | P1 | catalog فقط publishها. | draft/archive در API و UI مخفی. | NOT_TESTED |
| QA-042 | P2 | detail با تصاویر سالم. | URL تصویر 200 و layout پایدار. | NOT_TESTED |
| QA-043 | P2 | تصویر 404/خراب. | fallback و بدون خطای غیرضروری. | NOT_TESTED |
| QA-044 | P2 | gallery/zoom/thumbnail desktop. | interaction بدون crash. | NOT_TESTED |
| QA-045 | P2 | gallery/CTA در mobile. | overflow و tap target مناسب. | NOT_TESTED |
| QA-046 | P2 | FAQ و itinerary accordion. | state و anchor درست. | NOT_TESTED |
| QA-047 | P1 | CTA در hostname canonical. | Portal canonical، نه raw IP. | OPEN (TEN-006) |
| QA-048 | P1 | CTA در raw-IP/unknown host. | fail-closed، URL جعلی ممنوع. | OPEN (TEN-006) |
| QA-049 | P2 | search مثبت و empty. | نتیجه و empty state صحیح. | NOT_TESTED |
| QA-050 | P2 | reset/category/combined filters. | query normalize و reset کامل. | NOT_TESTED |
| QA-051 | P2 | cursor و page-size سقف‌دار. | duplicate/skip و limit abuse نباشد. | NOT_TESTED |

### E — Portal registration و شروط خرید (QA-052 تا QA-066)

| ID | Pri | اقدام | معیار قبولی | وضعیت |
|---|---|---|---|---|
| QA-052 | P1 | ثبت‌نام تور بدون approval. | ثبت، confirmation و status صحیح. | NOT_TESTED |
| QA-053 | P1 | ثبت‌نام نیازمند approval. | pending؛ ظرفیت نهایی نشود. | NOT_TESTED |
| QA-054 | P1 | auto-approve با شرط فعال. | فقط شرط مجاز auto شود. | NOT_TESTED |
| QA-055 | P1 | ثبت‌نام در full. | رد UI/API؛ ظرفیت تغییر نکند. | NOT_TESTED |
| QA-056 | P1 | draft/unpublished/archived. | public registration بسته. | NOT_TESTED |
| QA-057 | P1 | duplicate email/phone. | conflict/idempotency؛ رکورد دوم ناخواسته نباشد. | NOT_TESTED |
| QA-058 | P1 | party size یک و چند نفر. | ظرفیت و مبلغ بر اساس نفرات واقعی. | NOT_TESTED |
| QA-059 | P1 | فیلدهای تکمیلی required/optional. | validation و payload همسان. | NOT_TESTED |
| QA-060 | P1 | transport عمومی/شخصی/بدون transport. | فیلدهای شرطی درست show/save. | NOT_TESTED |
| QA-061 | P1 | personal-car driver با offered seats. | سقف صندلی درست. | NOT_TESTED |
| QA-062 | P0 | cross-tenant tour id. | 403/404؛ ثبت در tenant دیگر ممنوع. | NOT_TESTED |
| QA-063 | P2 | timeout هنگام register. | retry امن و بدون duplicate. | NOT_TESTED |
| QA-064 | P2 | mobile keyboard/RTL form. | fieldها قابل استفاده و label واضح. | NOT_TESTED |
| QA-065 | P1 | return از login به register. | catalog/tour و tenant حفظ شود. | NOT_TESTED |
| QA-066 | P1 | persistence بعد از refresh/new tab. | registration state قابل بازیابی. | NOT_TESTED |

### F — Approval، رزرو و ظرفیت (QA-067 تا QA-079)

| ID | Pri | اقدام | معیار قبولی | وضعیت |
|---|---|---|---|---|
| QA-067 | P1 | registration list و status filter. | count/list با API برابر. | NOT_TESTED |
| QA-068 | P1 | approve یک نفر. | status، capacity، finance و event یک‌بار. | NOT_TESTED |
| QA-069 | P1 | reject با دلیل. | دلیل، آزادشدن ظرفیت و اعلان. | NOT_TESTED |
| QA-070 | P1 | waitlist سپس approve. | ترتیب و ظرفیت رعایت. | NOT_TESTED |
| QA-071 | P1 | cancel قبل پرداخت. | status/capacity/notification صحیح. | NOT_TESTED |
| QA-072 | P1 | cancel بعد پرداخت/partial. | refund/credit و ledger reconcile. | NOT_TESTED |
| QA-073 | P1 | bulk approve/reject. | partial failure و idempotency. | NOT_TESTED |
| QA-074 | P1 | capacity race دو ثبت‌نام. | overbooking صفر. | NOT_TESTED |
| QA-075 | P2 | search/pagination registrations. | cursor بدون skip/duplicate. | NOT_TESTED |
| QA-076 | P2 | operational roster سالم. | rows، empty و error state تفکیک. | OPEN (001) |
| QA-077 | P2 | operational roster بدون ثبت‌نام. | empty state، نه 500. | NOT_TESTED |
| QA-078 | P2 | transport roster در دو navigation. | داده پایدار و بدون hydration. | OPEN (001/002) |
| QA-079 | P2 | mobile tour management. | actionها hidden/overflow نباشند. | NOT_TESTED |

### G — پرداخت، فیش و شماره کارت (QA-080 تا QA-098)

| ID | Pri | اقدام | معیار قبولی | وضعیت |
|---|---|---|---|---|
| QA-080 | P1 | ذخیره شماره کارت در Settings. | owner ذخیره و refresh مشاهده کند. | NOT_TESTED |
| QA-081 | P1 | نمایش شماره کارت در Portal پرداخت. | فقط tenant و زمان صحیح. | NOT_TESTED |
| QA-082 | P1 | payment رایگان. | بدون فیش؛ status و Telegram درست. | NOT_TESTED |
| QA-083 | P1 | payment کامل دستی. | amount/currency و balance صحیح. | NOT_TESTED |
| QA-084 | P1 | payment ناقص. | remaining و pending receipt درست. | NOT_TESTED |
| QA-085 | P1 | upload فیش سالم. | storage، metadata، queue و event. | NOT_TESTED |
| QA-086 | P1 | فایل فیش نامعتبر/بزرگ. | reject امن؛ orphan مالی/فایلی نباشد. | NOT_TESTED |
| QA-087 | P1 | approve receipt. | payment/registration/notification یک‌بار. | NOT_TESTED |
| QA-088 | P1 | reject receipt با دلیل. | بدهی برقرار و دلیل نمایش داده شود. | NOT_TESTED |
| QA-089 | P1 | duplicate receipt/payment. | idempotent و ledger یک‌بار. | NOT_TESTED |
| QA-090 | P1 | مبلغ/ارز ناسازگار. | API و UI reject دقیق. | NOT_TESTED |
| QA-091 | P1 | invoice paid/due/remaining. | جمع با finance source برابر. | NOT_TESTED |
| QA-092 | P1 | refund/cancel payment. | lifecycle و audit کامل. | NOT_TESTED |
| QA-093 | P2 | locale `actionable` fa/en. | raw key در UI/console صفر. | OPEN (003) |
| QA-094 | P2 | Excel final roster. | چهار sheet، همه رکوردها و جمع مبالغ. | FIXED_LOCALLY |
| QA-095 | P0 | Excel formula injection. | مقدار شروع‌شده با `=+-@` خنثی شود. | NOT_TESTED |
| QA-096 | P1 | Excel فقط final registrations. | unfinalized وارد هیچ sheet نشود. | NOT_TESTED |
| QA-097 | P1 | Excel بدهکار/تسویه‌شده. | هر فرد در دسته درست و جمع برابر. | NOT_TESTED |
| QA-098 | P1 | Excel بزرگ‌تر از page size. | همه رکوردها، نه فقط 50 اول. | NOT_TESTED |

### H — عضویت، Wallet و کد عضو (QA-099 تا QA-109)

| ID | Pri | اقدام | معیار قبولی | وضعیت |
|---|---|---|---|---|
| QA-099 | P1 | اجرای membership migration روی DB تستی. | backfill کامل و collision صفر. | READY AFTER DEPLOY |
| QA-100 | P1 | ثبت عضو جدید. | `DENALI-000001` backend-generated و immutable. | READY AFTER DEPLOY |
| QA-101 | P1 | دو ثبت هم‌زمان. | کدهای یکتا و ترتیب معتبر. | READY AFTER DEPLOY |
| QA-102 | P1 | Users search با نام. | عضو درست. | FIXED_LOCALLY |
| QA-103 | P1 | Users search با موبایل. | فرمت‌های مجاز ایران. | FIXED_LOCALLY |
| QA-104 | P1 | Users search با membership code. | فقط عضو همان tenant. | READY AFTER DEPLOY |
| QA-105 | P0 | کد tenant A در tenant B. | zero/403 و عدم نشت. | READY AFTER DEPLOY |
| QA-106 | P1 | invite و accept. | code/role/status و idempotency. | NOT_TESTED |
| QA-107 | P1 | suspend/reactivate/remove. | access و session invalidation. | NOT_TESTED |
| QA-108 | P1 | Wallet credit/debit. | amount/currency/balance rule. | NOT_TESTED |
| QA-109 | P1 | duplicate و negative wallet operation. | reject/idempotent و audit. | NOT_TESTED |

### I — Telegram و topicها (QA-110 تا QA-120)

| ID | Pri | اقدام | معیار قبولی | وضعیت |
|---|---|---|---|---|
| QA-110 | P1 | member registration event. | topic ثبت‌نام همان گروه. | NOT_TESTED |
| QA-111 | P1 | receipt submitted event. | topic receipt، نه registration. | NOT_TESTED |
| QA-112 | P1 | receipt approved event. | topic approval صحیح. | NOT_TESTED |
| QA-113 | P1 | receipt rejected event. | topic rejection و دلیل. | NOT_TESTED |
| QA-114 | P1 | ticket created/message posted. | topic ticket و thread id. | NOT_TESTED |
| QA-115 | P1 | topic missing/wrong. | fail-closed؛ ارسال به topic اشتباه ممنوع. | NOT_TESTED |
| QA-116 | P1 | event retry/duplicate. | dedupe و یک پیام نهایی. | NOT_TESTED |
| QA-117 | P1 | دو workspace با bot/token جدا. | route فقط به گروه همان workspace. | NOT_TESTED |
| QA-118 | P2 | settings test message. | فقط connectivity proof؛ جایگزین E2E نباشد. | NOT_TESTED |
| QA-119 | P2 | Telegram timeout/unavailable. | retry/queue و خطای قابل فهم. | NOT_TESTED |
| QA-120 | P0 | token در log/UI/export. | صفر secret exposure. | NOT_TESTED |

### J — Users، Settings و UI responsive (QA-121 تا QA-132)

| ID | Pri | اقدام | معیار قبولی | وضعیت |
|---|---|---|---|---|
| QA-121 | P1 | Users search/clear/sort. | query و نتیجه پایدار. | NOT_TESTED |
| QA-122 | P1 | invite duplicate و resend. | conflict و OTP صحیح. | NOT_TESTED |
| QA-123 | P1 | role change/ownership transfer. | owner guard و audit. | NOT_TESTED |
| QA-124 | P2 | Users pagination. | total/cursor درست. | NOT_TESTED |
| QA-125 | P1 | payment destination label/value. | key خام و مقدار stale نباشد. | FIXED_LOCALLY |
| QA-126 | P2 | branding/logo upload. | validation/storage/tenant isolation. | NOT_TESTED |
| QA-127 | P2 | integrations save/edit/test. | secret masking و persistence. | NOT_TESTED |
| QA-128 | P2 | equipment/language/theme/location CRUD. | create/update/delete و refresh. | NOT_TESTED |
| QA-129 | P2 | tour management عرض 320px. | بدون horizontal overflow. | NOT_TESTED |
| QA-130 | P2 | tour management عرض 768px. | actions و tables قابل استفاده. | NOT_TESTED |
| QA-131 | P2 | RTL/LTR و dark/light. | layout و contrast بدون regression. | NOT_TESTED |
| QA-132 | P2 | keyboard/focus/disabled states. | actionهای اصلی قابل دسترس. | NOT_TESTED |

### K — cross-flow و release (QA-133 تا QA-145)

| ID | Pri | اقدام | معیار قبولی | وضعیت |
|---|---|---|---|---|
| QA-133 | P1 | Marketing → Portal → registration. | end-to-end با return URL. | NOT_TESTED |
| QA-134 | P1 | registration → approval → booking. | state و event traceable. | NOT_TESTED |
| QA-135 | P1 | booking → finance. | invoice/obligation همسان. | NOT_TESTED |
| QA-136 | P1 | finance → wallet. | reference و ledger معتبر. | NOT_TESTED |
| QA-137 | P1 | هر مرحله → Telegram. | event و topic صحیح. | NOT_TESTED |
| QA-138 | P1 | API/worker restart با outbox pending. | event گم/duplicate نشود. | NOT_TESTED |
| QA-139 | P1 | Nginx refresh و deep-link. | routeهای واقعی بعد refresh باز شوند. | NOT_TESTED |
| QA-140 | P0 | PostgreSQL/RLS دو tenant. | read/write cross-tenant صفر. | NOT_TESTED |
| QA-141 | P1 | staging migration + health smoke. | migration و health سبز. | PENDING PR |
| QA-142 | P1 | staging login/tour/register/payment. | مسیر اصلی با SHA جاری سبز. | PENDING PR |
| QA-143 | P1 | staging Telegram event smoke. | registration، receipt و approval در topic درست. | PENDING PR |
| QA-144 | P1 | current PR CI. | همه checkهای همان HEAD سبز؛ skipped توضیح‌دار. | IN_PROGRESS |
| QA-145 | P0 | production readiness. | P0 باز صفر، secret masked، rollback و evidence bundle. | PENDING STAGING |

## 3. ترتیب اجرا

1. `QA-001..025` و findingهای P0 (`DENALI-005..008`).
2. مسیر خرید: `QA-026..079`.
3. مالی، فیش، شماره کارت و Excel: `QA-080..098`.
4. عضویت و Wallet: `QA-099..109`؛ پس از migration.
5. Telegram واقعی: `QA-110..120`؛ test message به‌تنهایی کافی نیست.
6. Users، settings و responsive: `QA-121..132`.
7. cross-flow، staging و release: `QA-133..145`.

## 4. تعریف بسته‌شدن

کار کامل نیست مگر اینکه:

- هیچ `NOT_TESTED` بدون owner و next command باقی نماند.
- هر `FIXED_LOCALLY` روی staging با SHA جاری تست شود.
- هر finding یا با root cause و regression test بسته شود یا با counter-evidence `NOT_A_BUG` شود.
- مسیر کامل `ساخت تور → انتشار → ثبت‌نام → تایید → پرداخت/فیش → تسویه → Telegram` اجرا شود.
- دو workspace، دو bot، دو group/topic و tenant isolation تست شوند.
- CI، migration و deploy به همان SHA متصل باشند.

## 5. وضعیت سند

- تعداد findingهای باز/blocked: 9.
- تعداد تسک‌های اتمی: 145.
- تعداد تسک‌های صرفاً runtime که بدون staging قابل بستن نیستند: مشخصاً با `PENDING PR` و `READY AFTER DEPLOY` علامت‌گذاری شده‌اند.
- این بازنویسی باید در PR فعلی دوباره CI شود؛ تا قبل از merge/deploy هیچ runtime fix ادعا نمی‌شود.
