# Integration Delivery Policy — Lean Enterprise Plan

تاریخ: 2026-06-27
وضعیت: Analysis / Plan only — نسخه‌ی lean و تراز با کد فعلی
دامنه: انتخاب و enforce کردن اینکه «کدام canonical field، برای کدام event، با کدام template، به کدام provider» منتشر شود.
هدف: حل نیاز واقعی admin delivery policy بدون overmodeling، بدون شکستن کد موجود، و بدون وابستگی به Denali/Telegram.

---

## 0. اصل طراحی این نسخه

این نسخه عمداً چند ایده‌ی enterprise را کوچک کرده است:

- **PDP/PEP سرویس جدا نمی‌سازیم.** همین `fieldPolicy` + helperهای موجود نقش policy decision را دارند.
- **جدول جدید delivery policy نمی‌سازیم.** از `IntegrationEventPolicy` موجود استفاده می‌کنیم و فقط ستون‌های nullable اضافه می‌کنیم، اگر persistence لازم شد.
- **catalog جدید موازی داخل `integrationSurface` نمی‌سازیم.** اول از چیزهای موجود مشتق می‌کنیم: `defaultEventPolicies`, `eventMappings`, `fieldPolicy.deliveryCandidateFieldIds`, و `fieldRegistry`.
- **generic form/template builder بزرگ نمی‌سازیم.** فقط یک panel کوچک داخل صفحه‌ی فعلی integrations اضافه می‌شود.
- **delivery history را وارد MVP نمی‌کنیم.** چون مسئله‌ی فعلی انتخاب field/template است، history بعداً به‌صورت مستقل می‌آید.

قاعده: اگر ساختار موجود جواب می‌دهد، extend می‌کنیم؛ abstraction جدید فقط وقتی اضافه شود که مجبور باشیم.

---

## 1. Ground Truth از کد فعلی

| بخش | وضعیت فعلی | تصمیم lean |
|-----|------------|------------|
| `WorkspaceIntegrationSurface` | دارد: providers, defaultEventPolicies, eventMappings, messageTemplates | فعلاً تغییر contract ندهیم مگر مجبور شویم |
| `IntegrationEventPolicy` | persist شده: eventType + enabled | همین را برای field/template override توسعه می‌دهیم |
| `resolveDeliveryFieldPolicy` | از `plugin.fieldPolicy.deliveryCandidateFieldIds` فیلدهای مجاز را می‌سازد | همین را reuse می‌کنیم |
| formatter | `{{field:<id>}}` را fail-closed render می‌کند | همین کافی است؛ raw payload slot ممنوع بماند |
| `/settings/integrations` | connection CRUD + event policy read-only | فقط panel کوچک برای event/fields/template اضافه شود |
| Denali | `integrationSurface` دارد ولی `fieldPolicy` ندارد | فقط Denali را consumer اول می‌کنیم، نه special-case |

---

## 2. شکاف واقعی، نه بیشتر

مشکل اصلی فقط این است:

1. Denali هنوز `fieldPolicy` ندارد، پس delivery field policy روی Denali اعمال نمی‌شود.
2. template دنالی هنوز `{{title}}` legacy-style است، نه `{{field:...}}`.
3. admin نمی‌تواند برای یک connection/event مشخص کند کدام fieldها در پیام بیایند.
4. UI meta فعلی candidate fields و template قابل تنظیم را نشان نمی‌دهد.

چیزهایی مثل delivery history، replay، multiple templates، template registry، event catalog بزرگ، و provider دوم **برای این مشکل لازم نیستند** و باید عقب بیفتند.

---

## 3. معماری حداقلی

مسیر نهایی بدون abstraction اضافه:

```text
Domain Event
  -> IntegrationPolicyEngine              # موجود: connection + event enabled + capability
  -> resolveDeliveryFieldPolicy           # موجود: candidates + visibility + values
  -> apply connection event override       # جدید کوچک: selectedFieldIds/templateOverride
  -> formatIntegrationDeliveryMessage      # موجود: {{field:id}} fail-closed
  -> provider adapter
```

قانون field نهایی:

```text
finalFieldIds = visibleFieldIds ∩ selectedFieldIds
```

اگر `selectedFieldIds` ذخیره نشده بود:

```text
finalFieldIds = visibleFieldIds
```

یعنی رفتار فعلی حفظ می‌شود و فقط وقتی admin چیزی انتخاب کند محدودتر می‌شود.

---

## 4. Phase A — Denali را به مسیر موجود وصل کن (کم‌ریسک)

### هدف
بدون UI و بدون DB migration، ثابت کنیم Denali هم از field policy و `{{field:...}}` استفاده می‌کند.

### تغییرات

1. ایجاد `packages/workspaces/denali/src/integrations/denali-field-policy.manifest.ts`
   - `deliveryCandidateFieldIds` فقط برای چند field امن و واقعاً موجود.
   - rule ساده برای `surface: "delivery"`، preferably `always`، مگر واقعاً lifecycle شرط لازم باشد.

2. attach کردن `fieldPolicy` در `packages/workspaces/denali/src/denali.plugin.ts`.

3. template فعلی `"Tour created: {{title}}"` فعلاً پایدار بماند، چون payload واقعی `TourCreated` هنوز field valueهای canonical مثل `title` را حمل نمی‌کند. تغییر به `{{field:...}}` بعد از payload enrichment انجام شود.

4. تست‌های هدفمند:
   - `resolveDeliveryFieldPolicy` برای workspaceType=`denali` دیگر `null` نیست.
   - formatter فقط fieldهای eligible را render می‌کند.
   - اگر field غیرمجاز در template آمد، empty string شود.

### چرا lean است؟
هیچ schema، endpoint، UI، یا contract جدید اضافه نمی‌شود. Denali ابتدا eligibility metadata را از مسیر موجود دریافت می‌کند؛ متن پیام تا زمان enrichment پایدار می‌ماند.

---

## 5. Phase B — Meta API کوچک برای UI

### هدف
صفحه‌ی integrations بتواند بفهمد برای connection/event چه fieldهایی قابل انتخاب‌اند، بدون اضافه کردن catalog جدید.

### تغییرات

1. توسعه‌ی `apps/api/src/integrations/platform/integration-surface-meta.ts`:
   - `eventPolicies`: از `provider.defaultEventPolicies`
   - `deliveryCandidateFieldIds`: از `plugin.fieldPolicy.deliveryCandidateFieldIds`
   - field label اگر از `fieldRegistry` قابل resolve است؛ اگر نه فقط `fieldId`.

2. بدون تغییر `WorkspaceIntegrationSurface` در این فاز.

3. تست meta:
   - Denali provider telegram eventهای موجود را برمی‌گرداند.
   - candidate fields از `fieldPolicy` می‌آید.
   - workspace بدون fieldPolicy لیست خالی می‌دهد.

### چرا lean است؟
به‌جای افزودن `events?` و `deliveryFields?` به contract، از منابع موجود استفاده می‌کنیم. اگر بعداً label/i18n پیچیده لازم شد، آن وقت contract را اضافه می‌کنیم.

---

## 6. Phase C — Persistence حداقلی روی جدول موجود

### هدف
admin بتواند برای هر connection/event، fields و template را ذخیره کند.

### migration افزودنی روی `IntegrationEventPolicy`

```text
selected_field_ids Json?      # array of string, nullable
message_template   String?    # nullable override
updated_by_user_id String?    # optional, اگر الگوی audit بخواهد
```

اسم‌ها می‌توانند با conventions Prisma نهایی شوند، ولی نکته این است: **جدول جدید نسازیم**.

### validation

- `selectedFieldIds` باید subset از `visible/candidate field ids` باشد.
- `messageTemplate` فقط اجازه دارد:
  - `{{field:<id>}}`
  - `{{eventType}}`
  - `{{aggregateId}}`
- `{{title}}` legacy فقط برای fallback code بماند؛ template admin نباید از آن استفاده کند.
- unknown field => reject در save، و همچنان fail-closed در runtime.

### repository/service

- توسعه‌ی `IntegrationPolicyRepository` موجود برای خواندن/نوشتن همین فیلدها.
- route کوچک:
  - `PATCH /integrations/:id/event-policies/:eventType`

### چرا lean است؟
همان مدل event policy موجود توسعه می‌یابد؛ route جدید کوچک است؛ engine بازنویسی نمی‌شود.

---

## 7. Phase D — Enforcement per-connection، بدون framework جدید

### هدف
dispatch برای هر connection بتواند override همان connection را اعمال کند.

### تغییر کوچک پیشنهادی
یک helper function، نه کلاس/framework:

```ts
resolveDeliveryFieldSelection({
  visibleFieldIds,
  fieldValues,
  selectedFieldIds,
})
```

خروجی:

```ts
{
  integrationDeliveryFieldIds,
  integrationDeliveryFieldValues,
}
```

در `dispatchIntegrationDomainEvent`، بعد از decisions، برای هر decision policy detail را بخوانیم و intersection کنیم.

### نکته مهم
`resolveDeliveryFieldPolicy` فعلی workspace-level است. برای admin selection باید مرحله‌ی کوچک per-connection اضافه شود؛ لازم نیست کل pipeline را با `resolveIntegrationDeliveryPlan` بزرگ بازنویسی کنیم. اگر بعداً پیچیده شد، آن helper می‌تواند به plan object evolve کند.

---

## 8. Phase E — UI کوچک، نه rewrite

در `apps/web/app/(app)/settings/integrations/integrations-settings-client.tsx` صفحه را بازنویسی نکنیم.

فقط یک subcomponent بسازیم:

```text
IntegrationEventDeliveryPolicyPanel
```

قابلیت‌ها:

- نشان دادن eventهای موجود connection.
- toggle enabled/disabled همان event.
- checklist fieldها از meta API.
- textarea کوچک template با راهنمای `{{field:...}}`.
- preview client-side ساده با sample values placeholder، یا server preview بعداً.

در MVP:

- delivery history نه.
- replay نه.
- template registry نه.
- provider دوم نه.
- autocomplete fancy نه؛ فقط لیست field ids کنار textarea کافی است.

---

## 9. Guardهای لازم، نه بیشتر

1. Unit test برای template validation.
2. Unit test برای selectedFieldIds subset validation.
3. Test برای Denali fieldPolicy.
4. Test برای meta API.
5. Test برای dispatch که fieldهای انتخاب‌نشده به payload delivery نمی‌روند.

Guard جدید فقط اگر pattern import خطرناک دیدیم:

- provider/worker نباید `field-policy` resolver import کنند.

فعلاً script guard بزرگ جدید لازم نیست؛ تست‌های هدفمند کافی‌اند.

---

## 10. چیزهایی که فعلاً انجام ندهیم

- `events?`/`deliveryFields?` جدید روی `WorkspaceIntegrationSurface`، مگر Phase B ثابت کند label/catalog از منابع موجود کافی نیست.
- جدول جدید delivery policy.
- delivery history UI.
- replay/manual retry UI.
- template registry چندنسخه‌ای.
- generic JSON schema renderer.
- provider دوم فقط برای اثبات معماری.
- PDP service یا OPA/Rego/Cedar.

---

## 11. ترتیب اجرای پیشنهادی

1. Phase A: Denali fieldPolicy + حفظ template پایدار تا enrichment.
2. Phase B: meta API کوچک برای candidate fields.
3. Phase C: nullable columns روی `IntegrationEventPolicy` + route patch.
4. Phase D: intersection per-connection در dispatch.
5. Phase E: panel کوچک در integrations UI.

این ترتیب هم incremental است، هم هر مرحله قابل تست است، هم اگر وسط راه متوقف شویم کد خراب یا نیمه‌تعریف‌شده نمی‌ماند.

---

## 12. Definition of Done کوچک

- Denali fieldPolicy داشته باشد و eligibility metadata تولید کند؛ template field-based بعد از enrichment فعال شود.
- admin بتواند برای `TourCreated` انتخاب کند کدام fieldها به Telegram بروند.
- انتخاب admin در همان `IntegrationEventPolicy` ذخیره شود.
- dispatch فقط fieldهای visible و selected را enqueue کند.
- provider adapter هیچ اطلاعی از field policy نداشته باشد.
- workspace بدون fieldPolicy همچنان رفتار قبلی را حفظ کند.

---

Architect, documentation status: Not Needed. Link to docs: TEMP/integration-delivery-policy-enterprise-plan.md
