import { useFormContext } from "react-hook-form";
import { FormField, Textarea } from "@tour/ui";

import type { TourCreateFormValues } from "../schemas/tourCreateSchema";

const mutedHelp = {
  fontSize: "0.8125rem",
  color: "var(--color-neutral-600, #525252)",
  margin: 0,
} as const;

export function PoliciesStep() {
  const { register } = useFormContext<TourCreateFormValues>();

  return (
    <div style={{ display: "grid", gap: "0.85rem" }}>
      <p style={{ ...mutedHelp, gridColumn: "1 / -1" }}>
        <strong style={{ fontWeight: 600, color: "var(--color-neutral-700, #404040)" }}>سیاست‌ها برای مسافر</strong>
        پر کردن این بخش در پیش‌نویس اجباری نیست، اما برای شفافیت لغو، استرداد و ایمنی بسیار کمک می‌کند. متن‌ها در خلاصهٔ بازبینی دیده می‌شوند؛ موارد حقوقی نهایی را با وضع کاری خود هماهنگ کنید.
      </p>

      <FormField
        label="سیاست لغو (کنسلی)"
        description="تا چه موعد مسافر می‌تواند بدون ضرر یا با جریمه لغو کند؛ هر جدول زمانی یا درصد را خلاصه بنویسید."
      >
        <Textarea
          rows={3}
          {...register("policies.cancellationPolicy")}
          placeholder={`مثل: لغو تا هفت روز قبل از حرکت: استرداد کامل جز کارمزد بانکی.
بین سه تا هفت روز قبل: بازپرداخت پنجاه درصد.
کمتر از سه روز: بدون استرداد جز در موارد قوه قهریه`}
        />
      </FormField>

      <FormField
        label="سیاست بازپرداخت"
        description="زمان و روش برگشت وجه، کسورات، و اینکه استرداد به چه حسابی انجام می‌شود."
      >
        <Textarea
          rows={3}
          {...register("policies.refundPolicy")}
          placeholder={`مثل: وجه حداکثر تا ۷۲ ساعت کاری به همان حساب واریزکننده برمی‌گردد.
کارمزد بانک و تراکنش بر عهده مسافر است.`}
        />
      </FormField>

      <FormField
        label="قوانین حضور در برنامه"
        description="تعهد به ساعت تجمع، همراهی با گروه، و رفتار هنگام اجرا."
      >
        <Textarea
          rows={3}
          {...register("policies.attendanceRules")}
          placeholder={`مثل: حاضر بودن دقیقاً سر ساعت اعلام‌شده در نقطه ملاقات الزام است.
جداشدن از گروه بدون هماهنگی لیدر ممنوع است.`}
        />
      </FormField>

      <FormField
        label="سیاست تأخیر"
        description="اگر مسافر دیر برسد گروه چه می‌کند؛ آیا منتظر می‌ماند یا بدون او حرکت می‌کند."
      >
        <Textarea
          rows={3}
          {...register("policies.lateArrivalPolicy")}
          placeholder={`مثل: بیش از پانزده دقیقه تأخیر بدون اطلاع قبلی؛ گروه بدون انتظار حرکت می‌کند و مسئولیت با مسافر است.`}
        />
      </FormField>

      <FormField
        label="سیاست عدم حضور (no-show)"
        description="اگر مسافر بدون اطلاع نیاید یا در محل نباشد؛ آیا کل مبلغ سوخت می‌شود یا بخشی برمی‌گردد."
      >
        <Textarea
          rows={3}
          {...register("policies.noShowPolicy")}
          placeholder={`مثل: عدم حضور بدون اطلاع تا دو ساعت قبل از حرکت: کل مبلغ تور غیرقابل استرداد است مگر طبق سیاست لغو.`}
        />
      </FormField>

      <FormField
        label="سیاست تأیید و قطعی شدن رزرو"
        description="شرایط نهایی شدن ثبت‌نام؛ بیعانه، تأیید لیدر، یا فهرست انتظار."
      >
        <Textarea
          rows={3}
          {...register("policies.confirmationPolicy")}
          placeholder={`مثل: رزرو پس از واریز بیعانه سی درصد قطعی می‌شود.
تا پرداخت بیعانه، جای در لیست برگزارکننده محفوظ است.`}
        />
      </FormField>

      <FormField
        label="سیاست ظرفیت و اجرای تور"
        description="حداقل نفر برای اجرا، لغو تور به‌خاطر کمبود نفر، یا لیست انتظار."
      >
        <Textarea
          rows={3}
          {...register("policies.capacityPolicy")}
          placeholder={`مثل: در صورت نرسیدن به حداقل شش نفر تا ۷۲ ساعت قبل، تور لغو و وجه کامل استرداد می‌شود.`}
        />
      </FormField>

      <FormField
        label="سیاست آب‌وهوا و شرایط جوی"
        description="تأخیر، لغو یا تغییر مسیر به‌خاطر هشدار جوی یا ایمنی."
      >
        <Textarea
          rows={3}
          {...register("policies.weatherPolicy")}
          placeholder={`مثل: در صورت هشدار سطح نارنجی یا بالاتر از سازمان هواشناسی، برنامه حداکثر تا ۲۴ ساعت قبل اعلام تأخیر یا لغو می‌شود.`}
        />
      </FormField>

      <FormField
        label="نکات ایمنی اجرا"
        description="هشدارهای عملیاتی و الزام پیروی از لیدر؛ این متن در backend در فیلد سیاست ایمنی ذخیره می‌شود."
      >
        <Textarea
          rows={3}
          {...register("policies.safetyNotes")}
          placeholder={`مثل: پیروی از دستور لیدر در مسیر و ارتفاع الزام است.
استفاده از مسیرهای خارج از برنامهٔ اعلام‌شده بدون هماهنگی ممنوع است.`}
        />
      </FormField>

      <FormField
        label="سلب مسئولیت و ریسک"
        description="متن کلی محدودیت مسئولیت برگزارکننده؛ در API زیر «قوانین رزرو» هم ذخیره می‌شود."
      >
        <Textarea
          rows={3}
          {...register("policies.riskDisclaimer")}
          placeholder={`مثل: شرکت‌کننده مسئول برآورد توان بدنی و تجهیزات شخصی است.
حوادث ناشی از عدم رعایت دستورات لیدر یا شرایط غیرقابل کنترل طبیعی، مشمول مسئولیت برگزارکننده نیست.`}
        />
      </FormField>
    </div>
  );
}
