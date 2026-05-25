import { PoliciesTextareaList } from "@/features/tours/wizard/groups/policies/PoliciesTextareaList";

const mutedHelp = {
  fontSize: "0.8125rem",
  color: "var(--color-neutral-600, #525252)",
  margin: 0,
} as const;

export function PoliciesStep() {
  return (
    <div style={{ display: "grid", gap: "0.85rem" }}>
      <p style={{ ...mutedHelp, gridColumn: "1 / -1" }}>
        <strong style={{ fontWeight: 600, color: "var(--color-neutral-700, #404040)" }}>سیاست‌ها برای مسافر</strong>
        پر کردن این بخش در پیش‌نویس اجباری نیست، اما برای شفافیت لغو، استرداد و ایمنی بسیار کمک می‌کند. متن‌ها در خلاصهٔ بازبینی دیده می‌شوند؛ موارد حقوقی نهایی را با وضع کاری خود هماهنگ کنید.
      </p>

      <PoliciesTextareaList />
    </div>
  );
}
