/**
 * Rebuilds the workspace equipment catalog for tenant subdomain `denali`.
 * Deletes all `workspace_equipment_items` for that workspace, then inserts a curated
 * Persian catalog (mountain, trekking, nature, desert, camp, safety, conference) with usage-oriented descriptions.
 *
 * Run from apps/api: `pnpm exec node --env-file=.env --import tsx src/scripts/seed-denali-equipment.ts`
 * Or: `pnpm --filter @apps/api seed:denali-equipment`
 */
import { DataSource } from "typeorm";

import { createDataSourceOptionsFromEnv } from "../database/database.config";
import { emitScriptInfo } from "./script-log";

type EquipmentRow = {
  sort_order: number;
  name: string;
  slug: string;
  category: string;
  description: string;
  icon: string | null;
  is_active: boolean;
};

export async function seedDenaliEquipment(): Promise<void> {
  const ds = new DataSource(createDataSourceOptionsFromEnv());
  await ds.initialize();
  try {
    const tenants = await ds.query<Array<{ id: string; name: string }>>(
      `SELECT id, name FROM tenants WHERE deleted_at IS NULL AND lower(trim(subdomain)) = lower(trim($1)) LIMIT 1`,
      ["denali"],
    );
    const tenant = tenants[0];
    if (!tenant) {
      console.error("No active tenant with subdomain `denali`. Create/fix subdomain first.");
      process.exitCode = 1;
      return;
    }

    const wsId = tenant.id as string;
    emitScriptInfo(`Resolved Denali workspace id=${wsId} name=${tenant.name}`);

    const del = await ds.query(`DELETE FROM workspace_equipment_items WHERE workspace_id = $1 RETURNING id`, [wsId]);
    emitScriptInfo(`Removed ${Array.isArray(del) ? del.length : 0} prior equipment row(s) for this workspace.`);

    const rows: EquipmentRow[] = [
      {
        sort_order: 10,
        name: "کلاه کوهنوردی استاندارد",
        slug: "climbing-helmet-en12492",
        category: "ایمنی",
        description:
          "برای مسیرهای سنگ‌نوردی، یخ‌نوردی فنی و عبور از زیر سنگ‌ریزه؛ از ضربهٔ سقوط سنگ یا برخورد به صخره محافظت می‌کند. در تورهای کوهستانی با عبور فنی یا کارگاه یخ توصیه می‌شود.",
        icon: null,
        is_active: true,
      },
      {
        sort_order: 20,
        name: "هارنس کوهنوردی",
        slug: "climbing-harness-seat",
        category: "کوهنوردی فنی",
        description:
          "برای یخ‌نوردی، سنگ‌نوردی با طناب ثابت و برنامه‌هایی که نیاز به کار با طناب دارند؛ نقطهٔ اتصال ایمن برای کارابین و ابزار فرود. فقط در تورهایی که لیدر استفاده از طناب را اعلام کرده باشد.",
        icon: null,
        is_active: true,
      },
      {
        sort_order: 30,
        name: "کرامپون سازگار با کفش",
        slug: "crampons-strap-on-12pt",
        category: "کوهنوردی فنی",
        description:
          "برف سفت، شیب‌های یخی و مسیرهای زمستانی؛ روی کفش کوه سازگار نصب می‌شود. برای صعودهای بالای خط برف و گلیسیر؛ حتماً با سایز کفش و نوع اتصال هماهنگ شود.",
        icon: null,
        is_active: true,
      },
      {
        sort_order: 40,
        name: "کارابین پیچ‌دار (اسکرو)",
        slug: "locking-carabiner-screwgate",
        category: "کوهنوردی فنی",
        description:
          "اتصال ابزار به هارنس، ساخت میزکار یا ایمن‌سازی تجهیزات گروهی؛ در برنامه‌های فنی و کمپ‌های بلند ارتفاع که لیدر بخواهد تجهیزات جداگانه ببندید.",
        icon: null,
        is_active: true,
      },
      {
        sort_order: 50,
        name: "عصای تلسکوپی (دو عدد)",
        slug: "trekking-poles-pair",
        category: "پیاده‌روی",
        description:
          "برای پیاده‌روی‌های چندروزه، شیب تند بالا و پایین، کاهش فشار زانو و تعادل روی برف نرم یا سنگریزه. در تورهای طبیعت‌گردی و کوهپیمه غیرفنی بسیار مفید است.",
        icon: null,
        is_active: true,
      },
      {
        sort_order: 60,
        name: "کفش کوهپیمایی مناسب مسیر",
        slug: "hiking-boots-b3-compatible",
        category: "پوشاک و پا",
        description:
          "برای مسیرهای سنگی، برفی و بارانی؛ باید گیرش کف و ساق مناسب نوع برنامه باشد. در تورهای کوهستانی چندروزه معمولاً الزام اصلی است؛ برای شهرگردی سبک لازم نیست.",
        icon: null,
        is_active: true,
      },
      {
        sort_order: 70,
        name: "کولهٔ ۳۵ تا ۵۵ لیتر",
        slug: "backpack-35-55l",
        category: "پیاده‌روی",
        description:
          "حمل لایه‌های لباس، آب، غذا و خواب سبک در تورهای چندروزه و کمپینگ سبک. برای روزانهٔ شهری بزرگ است؛ برای نیم‌روزه شهری اختیاری است.",
        icon: null,
        is_active: true,
      },
      {
        sort_order: 80,
        name: "کیسه خواب متناسب با دمای اعلام‌شده",
        slug: "sleeping-bag-rated",
        category: "خواب و کمپ",
        description:
          "برای شب‌مانی در ارتفاع، کمپ‌های کوهستانی و شب‌های سرد کویر؛ دما را با اعلام لیدر تطبیق دهید. در تورهای یک‌روزه بدون شب‌مانی معمولاً حمل نمی‌شود.",
        icon: null,
        is_active: true,
      },
      {
        sort_order: 90,
        name: "چادر سبک یا بی‌وی‌وی (طبق برنامه)",
        slug: "light-tent-or-bivy",
        category: "خواب و کمپ",
        description:
          "برای کمپ چندروزه در مسیرهای طبیعت‌گردی و برنامه‌های خودکفا؛ در تورهای لاج یا اقامتگاه اغلب لازم نیست. فقط اگر لیدر نوع اقامت را کمپ اعلام کرده باشد.",
        icon: null,
        is_active: true,
      },
      {
        sort_order: 100,
        name: "زیرانداز عایق (فوم یا بادی سبک)",
        slug: "sleeping-pad-insulated",
        category: "خواب و کمپ",
        description:
          "عایق حرارتی از زمین سرد؛ برای شب در ارتفاع یا کمپ‌های پاییزه/زمستانه ضروری است. در پیاده‌روی روزانه بدون خوابیدن روی زمین اختیاری است.",
        icon: null,
        is_active: true,
      },
      {
        sort_order: 110,
        name: "چراغ پیشانی + باتری یدک",
        slug: "headlamp-extra-batteries",
        category: "نور و ابزار",
        description:
          "حرکت قبل از طلوع، بعد از غروب، داخل چادر یا اضطرار شب؛ در تمام تورهای کوه و طبیعت توصیه می‌شود. برای سینما/شهرگردی روزانه معمولاً لازم نیست.",
        icon: null,
        is_active: true,
      },
      {
        sort_order: 120,
        name: "قمقمه یا بطری قابل پر کردن (۱٫۵ تا ۳ لیتر)",
        slug: "water-bottles-or-bladder",
        category: "آب و تغذیه",
        description:
          "تأمین آب در پیاده‌روی طولانی، کویر و روزهای گرم؛ در تورهای شهری نیم‌روزه هم برای جلوگیری از کم‌آبی مفید است.",
        icon: null,
        is_active: true,
      },
      {
        sort_order: 130,
        name: "دستکش گرم ضد باد (زمستان)",
        slug: "insulated-gloves-winter",
        category: "پوشاک و پا",
        description:
          "برای صبح‌های سرد ارتفاع، باد شدید و کار با طناب در سرما؛ در تورهای گرمسیری یا تابستان پایین ارتفاع معمولاً لازم نیست.",
        icon: null,
        is_active: true,
      },
      {
        sort_order: 140,
        name: "ست لباس لایه‌ای (پایه، میانی، بادگیر)",
        slug: "layered-clothing-system",
        category: "پوشاک و پا",
        description:
          "تنظیم دما در کوه، کویر (شب سرد) و باران ناگهانی؛ تقریباً در همهٔ تورهای outdoor چندفصل کاربرد دارد. لایهٔ میانی پشمی یا مصنوعی گرم برای توقف طولانی مهم است.",
        icon: null,
        is_active: true,
      },
      {
        sort_order: 150,
        name: "عینک آفتابی با UV و کرم ضدآفتاب",
        slug: "sunglasses-sunscreen-spf",
        category: "کویر و آفتاب",
        description:
          "برای کویر، برف (بازتاب UV قوی) و ارتفاع؛ از برف‌کوری و آفتاب‌سوختگی جلوگیری می‌کند. در گشت شهری روز آفتابی هم توصیه می‌شود.",
        icon: null,
        is_active: true,
      },
      {
        sort_order: 160,
        name: "باف گردن یا شال سبک ضد باد",
        slug: "neck-gaiter-or-buff",
        category: "پوشاک و پا",
        description:
          "محافظت گردن و صورت در باد، گردوغبار کویر و سرمای ناگهانی ارتفاع؛ سبک و چندمنظوره برای اکثر تورهای طبیعت.",
        icon: null,
        is_active: true,
      },
      {
        sort_order: 170,
        name: "کیف کمک‌های اولیهٔ شخصی سبک",
        slug: "personal-first-aid-kit",
        category: "ایمنی",
        description:
          "باند، ضدعفونی، مسکن شخصی با تجویز پزشک، پانسمان ساده؛ مکمل کیت لیدر است نه جایگزین آن. برای هر تور چندروزه و خانواده‌ها توصیه می‌شود.",
        icon: null,
        is_active: true,
      },
      {
        sort_order: 180,
        name: "سوت اضطراری یا آینهٔ سیگنال",
        slug: "emergency-whistle-signal",
        category: "ایمنی",
        description:
          "برای جلب توجه در مه، طوفان یا جدایی از گروه؛ وزن کم، در برنامه‌های کوه و کویر کنار چراغ پیشانی ارزش دارد.",
        icon: null,
        is_active: true,
      },
      {
        sort_order: 190,
        name: "گتر ضد آب برای برف و باران",
        slug: "gaiters-waterproof",
        category: "پوشاک و پا",
        description:
          "ورود برف، آب و خاک به داخل کفش را کم می‌کند؛ برای مسیرهای برفی، علفزار خیس و باران شدید مناسب است. در شهر معمولاً لازم نیست.",
        icon: null,
        is_active: true,
      },
      {
        sort_order: 200,
        name: "چاقوی چندکاره یا ابزار کوچک گروهی",
        slug: "multitool-or-small-knife",
        category: "نور و ابزار",
        description:
          "برش طناب پارگی، تعمیرات جزء تجهیزات کمپ، باز کردن بسته غذا؛ در تورهای خودکفا و کمپ مفید است؛ در پرواز حتماً قوانین حمل چاقو را رعایت کنید.",
        icon: null,
        is_active: true,
      },
      {
        sort_order: 210,
        name: "کفش ترکینگ سبک (تریل رانر)",
        slug: "trail-running-shoes-light",
        category: "ترکینگ و طبیعت‌گردی",
        description:
          "برای مسیرهای خاکی و سنگلاخ نسبتاً هموار، پیاده‌روی‌های چندساعته و ترکینگ روزانه بدون بار سنگین؛ در برنامه‌های فنی برف و یخ جای کفش کوه سفت را نمی‌گیرد.",
        icon: null,
        is_active: true,
      },
      {
        sort_order: 220,
        name: "جوراب کوهنوردی ضخیم (پشمی یا ترکیبی)",
        slug: "hiking-socks-thick-wool-blend",
        category: "پوشاک و پا",
        description:
          "کاهش تاول، عایق جزئی و مدیریت رطوبت پا؛ برای ترکینگ چندروزه، کوه و کویر (پیاده‌روی طولانی) توصیه می‌شود. حداقل یک جفت اضافه برای شب‌مانی ببرید.",
        icon: null,
        is_active: true,
      },
      {
        sort_order: 230,
        name: "کلاه لبه‌دار یا دوقلو ضد آفتاب",
        slug: "wide-brim-hat-or-legionnaire",
        category: "کویر و آفتاب",
        description:
          "محافظت صورت و گردن از آفتاب مستقیم؛ در کویر، دریا و ارتفاع برفی در روز آفتابی ضروری است. برای همایش‌های فضای باز یا استراحت بین جلسات هم مفید است.",
        icon: null,
        is_active: true,
      },
      {
        sort_order: 240,
        name: "پانچو یا جاکت ضد آب فشرده",
        slug: "packable-rain-jacket-or-poncho",
        category: "ترکینگ و طبیعت‌گردی",
        description:
          "باران ناگهانی در جنگل و کوه؛ سبک و کم‌حجم برای طبیعت‌گردی یک‌روزه. در تور شهری بارانی هم از خیس شدن نجات می‌دهد.",
        icon: null,
        is_active: true,
      },
      {
        sort_order: 250,
        name: "اسپری یا لوسیون دافع حشره",
        slug: "insect-repellent-spray",
        category: "طبیعت و جنگل",
        description:
          "پشه و پشه بومی در تالاب، جنگل و کنار آب؛ برای طبیعت‌گردی شب‌مانی و غروب‌ها مهم است. در کویر و سالن معمولاً لازم نیست.",
        icon: null,
        is_active: true,
      },
      {
        sort_order: 260,
        name: "دوربین دوچشمی سبک",
        slug: "compact-binoculars-8x25",
        category: "طبیعت و جنگل",
        description:
          "پرنده‌نگری، مشاهده حیات وحش از فاصله امن و لذت منظره در مرتفع؛ برای سمینارهای میدانی و بازدید از مناظر دوردست هم کاربرد دارد.",
        icon: null,
        is_active: true,
      },
      {
        sort_order: 270,
        name: "فلاسک یا ماگ حرارتی نوشیدنی",
        slug: "thermos-mug-hot-cold",
        category: "آب و تغذیه",
        description:
          "حفظ دمای چای، آب و نوشیدنی در سرمای کوه یا شب کویر؛ در ترکینگ زمستانی و اتوبوس‌های بین‌شهری طولانی راحتی می‌دهد.",
        icon: null,
        is_active: true,
      },
      {
        sort_order: 280,
        name: "کیسهٔ فشرده‌سازی لباس",
        slug: "compression-stuff-sacks",
        category: "خواب و کمپ",
        description:
          "کاهش حجم کیسه خواب و لباس در کوله؛ برای ترکینگ چندروزه و پرواز به مقصد برنامه مفید است.",
        icon: null,
        is_active: true,
      },
      {
        sort_order: 290,
        name: "فیلتر آب قابل حمل یا قرص تصفیه",
        slug: "portable-water-filter-or-tabs",
        category: "آب و تغذیه",
        description:
          "مسیرهای دور از چشمهٔ مطمئن یا اضطرار؛ فقط با راهنمایی لیدر استفاده شود. برای تورهای شهری و هتل معمولاً بی‌معنی است.",
        icon: null,
        is_active: true,
      },
      {
        sort_order: 300,
        name: "نمک و پودر الکترولیت (ساشه)",
        slug: "electrolyte-sachets",
        category: "آب و تغذیه",
        description:
          "جلوگیری از ضعف و گرفتگی در گرما، کویر و روزهای طولانی ترکینگ؛ با آب همراه شود. برای همایش چندروزه در گرما هم برای شرکت‌کنندگان پرتحرک مفید است.",
        icon: null,
        is_active: true,
      },
      {
        sort_order: 310,
        name: "روپوش آفتاب‌گیر آستین بلند سبک",
        slug: "light-sun-shirt-upf",
        category: "کویر و آفتاب",
        description:
          "پوشش پوست بدون گرم شدن زیاد در کویر و تابستان؛ مکمل کرم ضدآفتاب است. برای قایق‌سوری و ساحل هم مناسب است.",
        icon: null,
        is_active: true,
      },
      {
        sort_order: 320,
        name: "کیسه زیپ‌دار ضد گرد برای گوشی و دوربین",
        slug: "zip-bags-electronics-desert-dust",
        category: "کویر و آفتاب",
        description:
          "محافظت از گرد و شن ریز در طوفان شن و پیاده‌روی طولانی کویر؛ برای تورهای ماشین‌سواری در جاده خاکی هم پیشنهاد می‌شود.",
        icon: null,
        is_active: true,
      },
      {
        sort_order: 330,
        name: "ماسک پارچه‌ای یا N95 سبک ضد گرد",
        slug: "dust-mask-light-n95-style",
        category: "کویر و آفتاب",
        description:
          "گرد و غبار شدید جاده و باد؛ در کویر و بعضی مسیرهای خاکی. در سالن بسته معمولاً لازم نیست مگر توصیهٔ بهداشتی رویداد.",
        icon: null,
        is_active: true,
      },
      {
        sort_order: 340,
        name: "کرم مرطوب‌کننده و نگه‌دارندهٔ لب",
        slug: "lip-balm-moisturizer-desert-cold",
        category: "کویر و آفتاب",
        description:
          "خشکی پوست و ترک لب در باد کویر و سرمای کوه؛ جزئی کوچک با اثر بزرگ در چندروزه. برای سفرهای هوایی طولانی هم راحت است.",
        icon: null,
        is_active: true,
      },
      {
        sort_order: 350,
        name: "طناب کمکی سبک (کوردلت ۶–۷ میلی‌متر)",
        slug: "accessory-cord-cordelette",
        category: "کوهنوردی فنی",
        description:
          "میزکار ساده، کشیدن بار، تعمیرات؛ فقط با مهارت یا دستور لیدر. برای ترکینگ غیرفنی حمل نکنید مگر برای کارگاه آموزشی.",
        icon: null,
        is_active: true,
      },
      {
        sort_order: 360,
        name: "ابزار یخ (پیولت، قاشق یخ)",
        slug: "ice-axe-piolet",
        category: "کوهنوردی فنی",
        description:
          "سرشاخهٔ برفی، شیب تند زمستانی و مهار سرازیر (خودمهار) در برف؛ فقط در برنامه‌های اعلام‌شدهٔ فنی و با آموزش. در طبیعت‌گردی تابستانه حمل نکنید.",
        icon: null,
        is_active: true,
      },
      {
        sort_order: 370,
        name: "کلاه پشمی یا توپ زمستانی",
        slug: "winter-beanie-hat",
        category: "پوشاک و پا",
        description:
          "از دست دادن حرارت از سر جلوگیری می‌کند؛ شب ارتفاع، کمپ زمستانه و صبح زود کویر سرد. در همایش سالن سرد بدون نیاز به کلاه رسمی گاهی کاربرد دارد.",
        icon: null,
        is_active: true,
      },
      {
        sort_order: 380,
        name: "صندلی کمپ تاشو سبک (اختیاری)",
        slug: "lightweight-camp-chair",
        category: "خواب و کمپ",
        description:
          "راحتی در کمپ، توقف‌های طولانی عکاسی و پیک‌نیک طبیعت؛ وزن و حجم دارد — فقط اگر لیدر حمل شخصی را تأیید کرده باشد.",
        icon: null,
        is_active: true,
      },
      {
        sort_order: 390,
        name: "اسپورک یا قاشق کمپ سبک",
        slug: "titanium-spork-camp",
        category: "خواب و کمپ",
        description:
          "وعده‌های گروهی و بسته‌های آماده در مسیر؛ برای تورهای لاج با رستوران معمولاً لازم نیست.",
        icon: null,
        is_active: true,
      },
      {
        sort_order: 400,
        name: "کیسه خواب لاینر (پوش داخلی)",
        slug: "sleeping-bag-liner-silk-fleece",
        category: "خواب و کمپ",
        description:
          "چند درجه به گرمای کیسه کمک می‌کند و کیسه را تمیز نگه می‌دارد؛ برای شب‌مانی هتل یا مهمانسرا در تور ترکیبی هم به‌درد می‌خورد.",
        icon: null,
        is_active: true,
      },
      {
        sort_order: 410,
        name: "چادر اضطراری سبک (بقا)",
        slug: "emergency-shelter-bivy-tube",
        category: "ایمنی",
        description:
          "محافظ موقت از باد و باران در اضطرار کوه؛ مکمل چادر اصلی نیست. برای گروه‌های فنی و لیدرهای مجهز پیشنهاد می‌شود.",
        icon: null,
        is_active: true,
      },
      {
        sort_order: 420,
        name: "جی‌پی‌اس دستی یا ساعت با مسیر آفلاین",
        slug: "handheld-gps-or-watch-tracks",
        category: "ترکینگ و طبیعت‌گردی",
        description:
          "مسیریابی کمکی وقتی پوشش موبایل نیست؛ باید با نقشه و باطری مدیریت شود. برای رهبران فنی و شرکت‌کنندگان با تجربه در مسیرهای دورافتاده.",
        icon: null,
        is_active: true,
      },
      {
        sort_order: 430,
        name: "پاوربانک با ظرفیت کافی (پرواز: ظرفیت مجاز)",
        slug: "power-bank-flight-safe",
        category: "همایش و سمینار",
        description:
          "شارژ گوشی بین جلسات، ثبت یادداشت و عکس از اسلایدها؛ در سفرهای چندروزه و کمپ هم برای اضطرار. قبل از پرواز محدودیت میلی‌آمپر ایرلاین را چک کنید.",
        icon: null,
        is_active: true,
      },
      {
        sort_order: 440,
        name: "دفترچه یادداشت و خودکار",
        slug: "notebook-pen-conference",
        category: "همایش و سمینار",
        description:
          "ثبت نکات کلیدی، ایده‌ها و تماس‌ها در کارگاه و پنل؛ جایگزین کامل اپ نیست و در میدان بارانی داخل کیسه ضد آب نگه دارید.",
        icon: null,
        is_active: true,
      },
      {
        sort_order: 450,
        name: "هدفون یا هندزفری باکیفیت",
        slug: "headphones-translation-workshop",
        category: "همایش و سمینار",
        description:
          "جلسات آنلاین هیبرید، تماس ویدیویی و گاه گیرندهٔ ترجمه همزمان؛ در اتوبوس بین مقصدها برای پادکست هم کاربرد دارد.",
        icon: null,
        is_active: true,
      },
      {
        sort_order: 460,
        name: "لپ‌تاپ یا تبلت (طبق اعلام برنامه کارگاه)",
        slug: "laptop-tablet-if-workshop",
        category: "همایش و سمینار",
        description:
          "کارگاه کدنویسی، طراحی و فایل‌های ارائه؛ فقط اگر کارت دعوت یا لیدر الزام کرده باشد. در طبیعت‌گردی معمولاً حمل نشود مگر تور آموزشی.",
        icon: null,
        is_active: true,
      },
      {
        sort_order: 470,
        name: "بج‌نگهدارنده یا گردن‌آویز کارت شناسایی",
        slug: "lanyard-badge-holder",
        category: "همایش و سمینار",
        description:
          "دسترسی سریع به سالن و ناهار کاری؛ در تورهای B2B و رویداد چندروزه رایج است. برای کوه و کویر بی‌ربط است.",
        icon: null,
        is_active: true,
      },
      {
        sort_order: 480,
        name: "ژاکت یا شال سبک برای سالن سرد",
        slug: "light-jacket-conference-hall-ac",
        category: "همایش و سمینار",
        description:
          "تهویهٔ قوی سالن‌ها و هتل‌های لوکس؛ روی لباس رسمی بدون حجیم شدن. بعد از جلسه برای شب شهری هم قابل استفاده است.",
        icon: null,
        is_active: true,
      },
      {
        sort_order: 490,
        name: "بطری آب قابل پر برای جلسات طولانی",
        slug: "refillable-bottle-indoor-events",
        category: "همایش و سمینار",
        description:
          "کم‌آبی در پنل‌های چندساعته و شبکه‌سازی؛ پر کردن از ایستگاه آب در محل رویداد. مکمل همان بطری outdoor است ولی تأکید روی محیط بسته.",
        icon: null,
        is_active: true,
      },
      {
        sort_order: 500,
        name: "کارت ویزیت یا نسخهٔ دیجیتال آماده (کیوآر)",
        slug: "business-cards-or-digital-qr",
        category: "همایش و سمینار",
        description:
          "شبکه‌سازی حرفه‌ای بعد از سخنرانی و در گالهٔ نمایشگاه؛ برای تورهای تجاری و آشنایی با تأمین‌کنندگان محلی مفید است.",
        icon: null,
        is_active: true,
      },
      {
        sort_order: 510,
        name: "چشم‌بند و گوش‌گیر سبک (خواب اتوبوس/هتل)",
        slug: "sleep-mask-earplugs-travel",
        category: "همایش و سمینار",
        description:
          "استراحت بین جلسات و حمل شبانه؛ برای کاروان‌های ترکیبی همایش + گشت شهری کاربرد دارد.",
        icon: null,
        is_active: true,
      },
      {
        sort_order: 520,
        name: "کیف لپ‌تاپ یا کاور ضد ضربه",
        slug: "laptop-sleeve-padded",
        category: "همایش و سمینار",
        description:
          "محافظت در جابه‌جایی بین سالن و هتل و در ماشین گروهی؛ اگر دستگاه همراه دارید تقریباً ضروری است.",
        icon: null,
        is_active: true,
      },
    ];

    for (const row of rows) {
      await ds.query(
        `INSERT INTO workspace_equipment_items
          (workspace_id, name, slug, category, description, icon, is_active, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [wsId, row.name, row.slug, row.category, row.description, row.icon, row.is_active, row.sort_order],
      );
    }

    emitScriptInfo(`Inserted ${rows.length} equipment item(s) for denali (workspace_id=${wsId}).`);
  } finally {
    await ds.destroy();
  }
}

seedDenaliEquipment().catch((error: unknown) => {
  console.error(
    "seed-denali-equipment failed:",
    error instanceof Error ? error.stack ?? error.message : String(error),
  );
  process.exitCode = 1;
});
