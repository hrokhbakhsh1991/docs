/**
 * Traveler registration wizard copy (Phase 16.5).
 */
export const REGISTER_FOR_TOUR_COPY = {
  transport: {
    fieldLabel: "نحوه حضور و خودرو",
    publicTransport: "با حمل‌ونقل گروهی (قطار / اتوبوس / …)",
    selfVehicle: "با خودروی شخصی شرکت می‌کنم",
    groupVehicle: "بدون خودرو هستم (متقاضی صندلی گروهی)",
    groupOnlyHint: "این تور فقط با حمل‌ونقل گروهی برگزار می‌شود.",
    seatLabel: "تعداد صندلی‌های خالی جهت پذیرش همسفر",
    seatHint: "۱ تا ۳ صندلی (اختیاری)",
    noteLabel: "یادداشت برای لیدر",
    notePlaceholder:
      "یادداشت برای لیدر (مدل خودرو، تجهیزات همراه، یا سابقه سفرهای آفرودی خود را بنویسید)...",
    seatOnlySelfVehicle: "صندلی اضافه فقط برای خودروی شخصی است.",
    seatRange: "۱ تا ۳ صندلی انتخاب کنید.",
    isDriverLabel: "آیا راننده هستید؟",
    plateNumberLabel: "شماره پلاک خودرو",
    plateNumberPlaceholder: "ایران ۱۱ - ۱۲۳ ج ۴۵",
    shareFuelCostLabel: "تمایل به پرداخت هزینه سوخت دارم",
    personalInsuranceLabel: "تأیید می‌کنم که بیمه حوادث شخصی معتبر دارم",
    travelInsuranceLabel: "متقاضی بیمه سفر (توسط برگزارکننده) هستم",
    personalInsuranceRequired: "داشتن بیمه حوادث شخصی برای این تور الزامی است.",
  },
  peaks: {
    fieldLabel: "تعداد قله‌های صعودشدهٔ اخیر با این آژانس",
    hint: "برای تورهای کوهنوردی؛ در صورت کافی بودن سابقه، ثبت‌نام بدون انتظار تایید رهبر پذیرفته می‌شود.",
    required: "لطفاً سابقه قله‌های خود را انتخاب کنید.",
  },
  profile: {
    selfNationalIdLabel: "کد ملی",
    selfNationalIdHint:
      "این تور کد ملی را الزامی می‌کند. کد ملی شما یک‌بار در پروفایل ذخیره می‌شود و برای ثبت‌نام‌های بعدی استفاده می‌شود.",
    selfNationalIdReadOnlyHint: "کد ملی از پروفایل شما (فقط مشاهده).",
  },
  validation: {
    fullNameRequired: "نام و نام خانوادگی الزامی است.",
    phoneRequired: "شماره تماس الزامی است.",
    phoneTooLong: "شماره تماس بیش از حد طولانی است.",
    phoneFormat:
      "۷ تا ۲۰ رقم (اختیاری + در ابتدا). فاصله، خط تیره و پرانتز مجاز است.",
    nationalIdRequired: "کد ملی شرکت‌کننده الزامی است.",
    nationalIdInvalid: "کد ملی وارد شده معتبر نیست.",
  },
} as const;
