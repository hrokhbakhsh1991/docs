/** Persian contextual guidance for Denali wizard + classic edit (Phase 16.12). */
export const DENALI_FIELD_HINTS = {
  title:
    "نامی جذاب و کوتاه انتخاب کنید. نمونه: صعود زمستانه به دماوند جبهه جنوبی",
  locationZones:
    "برای انتشار تور، هر ایستگاه تجمع باید عنوان، آدرس و پین روی نقشه داشته باشد. نقطه آغاز، محل شروع پیمایش آفرود یا کوه است.",
  gatheringStations:
    "می‌توانید چند ایستگاه تجمع با ساعت حضور جدا تعریف کنید. برای انتشار، همه ایستگاه‌ها باید عنوان و مختصات دقیق داشته باشند.",
  minRequiredPeaks:
    "با تنظیم این عدد، کوهنوردان باسابقه که این تعداد صندلی/قله را با شما صعود کرده‌اند، بدون نیاز به تایید دستی شما مستقیم به درگاه پرداخت هدایت می‌شوند.",
  insuranceAndNationalId:
    "فعال کردن این تیک‌ها، مسافر را در فرم ثبت‌نام مجبور به وارد کردن کدملی دقیق و ارائه کارت بیمه ورزشی معتبر می‌کند.",
} as const;

export const denaliFieldHintStyle = {
  margin: "0.35rem 0 0",
  fontSize: "0.82rem",
  lineHeight: 1.65,
  color: "var(--color-slate-500)",
  direction: "rtl" as const,
};
