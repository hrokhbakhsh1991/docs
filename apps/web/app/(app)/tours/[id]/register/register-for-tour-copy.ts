/**
 * Traveler registration wizard copy (Phase 16.5).
 */
export const REGISTER_FOR_TOUR_COPY = {
  transport: {
    fieldLabel: "نحوه حضور و خودرو",
    selfVehicle: "با خودروی آفرود شخصی شرکت می‌کنم",
    groupVehicle: "بدون خودرو هستم (متقاضی صندلی گروهی)",
    seatLabel: "تعداد صندلی‌های خالی جهت پذیرش همسفر",
    seatHint: "۱ تا ۳ صندلی (اختیاری)",
    noteLabel: "یادداشت برای لیدر",
    notePlaceholder:
      "یادداشت برای لیدر (مدل خودرو، تجهیزات همراه، یا سابقه سفرهای آفرودی خود را بنویسید)...",
    seatOnlySelfVehicle: "صندلی اضافه فقط برای خودروی شخصی است.",
    seatRange: "۱ تا ۳ صندلی انتخاب کنید.",
  },
  peaks: {
    fieldLabel: "تعداد قله‌های صعودشدهٔ اخیر با این آژانس",
    hint: "برای تورهای کوهنوردی؛ در صورت کافی بودن سابقه، ثبت‌نام بدون انتظار تایید رهبر پذیرفته می‌شود.",
    required: "لطفاً سابقه قله‌های خود را انتخاب کنید.",
  },
  validation: {
    fullNameRequired: "نام و نام خانوادگی الزامی است.",
    phoneRequired: "شماره تماس الزامی است.",
    phoneTooLong: "شماره تماس بیش از حد طولانی است.",
    phoneFormat:
      "۷ تا ۲۰ رقم (اختیاری + در ابتدا). فاصله، خط تیره و پرانتز مجاز است.",
  },
} as const;
