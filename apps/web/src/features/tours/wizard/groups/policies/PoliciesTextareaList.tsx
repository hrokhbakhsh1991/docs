"use client";

import type { TourCreateFormValues } from "@/components/tours/wizard/legacy/schemas/tourCreateSchema";

import { LabeledTextareaField } from "../primitives/LabeledTextareaField";

type PoliciesTextareaItem = {
  /** RHF path under `policies.*`. */
  name: Extract<keyof TourCreateFormValues["policies"], string> extends never
    ? never
    : `policies.${Extract<keyof TourCreateFormValues["policies"], string>}`;
  label: string;
  description: string;
  placeholder: string;
};

/**
 * Static `policies.*` field configuration — keeps copy + placeholders co-located so the rendering
 * loop below stays declarative. Order intentionally matches the legacy JSX in `PoliciesStep.tsx`.
 */
const POLICY_FIELDS: readonly PoliciesTextareaItem[] = [
  {
    name: "policies.cancellationPolicy",
    label: "سیاست لغو (کنسلی)",
    description:
      "تا چه موعد مسافر می‌تواند بدون ضرر یا با جریمه لغو کند؛ هر جدول زمانی یا درصد را خلاصه بنویسید.",
    placeholder: `مثل: لغو تا هفت روز قبل از حرکت: استرداد کامل جز کارمزد بانکی.
بین سه تا هفت روز قبل: بازپرداخت پنجاه درصد.
کمتر از سه روز: بدون استرداد جز در موارد قوه قهریه`,
  },
  {
    name: "policies.refundPolicy",
    label: "سیاست بازپرداخت",
    description: "زمان و روش برگشت وجه، کسورات، و اینکه استرداد به چه حسابی انجام می‌شود.",
    placeholder: `مثل: وجه حداکثر تا ۷۲ ساعت کاری به همان حساب واریزکننده برمی‌گردد.
کارمزد بانک و تراکنش بر عهده مسافر است.`,
  },
  {
    name: "policies.attendanceRules",
    label: "قوانین حضور در برنامه",
    description: "تعهد به ساعت تجمع، همراهی با گروه، و رفتار هنگام اجرا.",
    placeholder: `مثل: حاضر بودن دقیقاً سر ساعت اعلام‌شده در نقطه ملاقات الزام است.
جداشدن از گروه بدون هماهنگی لیدر ممنوع است.`,
  },
  {
    name: "policies.lateArrivalPolicy",
    label: "سیاست تأخیر",
    description: "اگر مسافر دیر برسد گروه چه می‌کند؛ آیا منتظر می‌ماند یا بدون او حرکت می‌کند.",
    placeholder: `مثل: بیش از پانزده دقیقه تأخیر بدون اطلاع قبلی؛ گروه بدون انتظار حرکت می‌کند و مسئولیت با مسافر است.`,
  },
  {
    name: "policies.noShowPolicy",
    label: "سیاست عدم حضور (no-show)",
    description: "اگر مسافر بدون اطلاع نیاید یا در محل نباشد؛ آیا کل مبلغ سوخت می‌شود یا بخشی برمی‌گردد.",
    placeholder: `مثل: عدم حضور بدون اطلاع تا دو ساعت قبل از حرکت: کل مبلغ تور غیرقابل استرداد است مگر طبق سیاست لغو.`,
  },
  {
    name: "policies.confirmationPolicy",
    label: "سیاست تأیید و قطعی شدن رزرو",
    description: "شرایط نهایی شدن ثبت‌نام؛ بیعانه، تأیید لیدر، یا فهرست انتظار.",
    placeholder: `مثل: رزرو پس از واریز بیعانه سی درصد قطعی می‌شود.
تا پرداخت بیعانه، جای در لیست برگزارکننده محفوظ است.`,
  },
  {
    name: "policies.capacityPolicy",
    label: "سیاست ظرفیت و اجرای تور",
    description: "حداقل نفر برای اجرا، لغو تور به‌خاطر کمبود نفر، یا لیست انتظار.",
    placeholder: `مثل: در صورت نرسیدن به حداقل شش نفر تا ۷۲ ساعت قبل، تور لغو و وجه کامل استرداد می‌شود.`,
  },
  {
    name: "policies.weatherPolicy",
    label: "سیاست آب‌وهوا و شرایط جوی",
    description: "تأخیر، لغو یا تغییر مسیر به‌خاطر هشدار جوی یا ایمنی.",
    placeholder: `مثل: در صورت هشدار سطح نارنجی یا بالاتر از سازمان هواشناسی، برنامه حداکثر تا ۲۴ ساعت قبل اعلام تأخیر یا لغو می‌شود.`,
  },
  {
    name: "policies.safetyNotes",
    label: "نکات ایمنی اجرا",
    description: "هشدارهای عملیاتی و الزام پیروی از لیدر؛ این متن در backend در فیلد سیاست ایمنی ذخیره می‌شود.",
    placeholder: `مثل: پیروی از دستور لیدر در مسیر و ارتفاع الزام است.
استفاده از مسیرهای خارج از برنامهٔ اعلام‌شده بدون هماهنگی ممنوع است.`,
  },
  {
    name: "policies.riskDisclaimer",
    label: "سلب مسئولیت و ریسک",
    description: "متن کلی محدودیت مسئولیت برگزارکننده؛ در API زیر «قوانین رزرو» هم ذخیره می‌شود.",
    placeholder: `مثل: شرکت‌کننده مسئول برآورد توان بدنی و تجهیزات شخصی است.
حوادث ناشی از عدم رعایت دستورات لیدر یا شرایط غیرقابل کنترل طبیعی، مشمول مسئولیت برگزارکننده نیست.`,
  },
];

/**
 * Renders the `policies` group as a uniform stack of `LabeledTextareaField`s.
 *
 * Behavior parity (versus legacy `PoliciesStep` inline JSX):
 * - Field order matches the previous JSX 1:1.
 * - All fields use `register(name)` via the ambient `useFormContext` (read inside the primitive).
 * - No error UI was wired in the legacy JSX; `error` stays `undefined` here for parity.
 *
 * TODO (future): pull copy into i18n message catalog (`apps/web/messages/{en,fa}.json`).
 */
export function PoliciesTextareaList() {
  return (
    <>
      {POLICY_FIELDS.map((item) => (
        <LabeledTextareaField
          key={item.name}
          name={item.name}
          label={item.label}
          description={item.description}
          placeholder={item.placeholder}
          rows={3}
        />
      ))}
    </>
  );
}
