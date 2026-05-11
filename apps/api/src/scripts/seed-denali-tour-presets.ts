/**
 * Inserts 10 diverse workspace tour-creation presets for tenant subdomain `denali`.
 * Idempotent for names prefixed with `دنالی-`: deletes prior seeded rows then re-inserts.
 *
 * Run from apps/api: `pnpm exec node --env-file=.env --import tsx src/scripts/seed-denali-tour-presets.ts`
 */
import { DataSource } from "typeorm";

import { createDataSourceOptionsFromEnv } from "../database/database.config";
import { mergeLegacyMatchIntoDefaults } from "../modules/settings-locations/tour-preset-defaults-legacy";
import { emitScriptInfo } from "./script-log";

type ThemeRow = { id: string; name: string };

export async function seedDenaliTourPresets(): Promise<void> {
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
    emitScriptInfo(`Resolved Denali workspace (tenant) id=${wsId} name=${tenant.name}`);

    const themes = await ds.query<ThemeRow[]>(
      `SELECT id, name FROM workspace_tour_themes
       WHERE workspace_id = $1 AND is_active = true
       ORDER BY sort_order ASC, name ASC
       LIMIT 4`,
      [wsId],
    );
    const t0 = themes[0]?.id ?? null;
    const t1 = themes[1]?.id ?? themes[0]?.id ?? null;
    emitScriptInfo(`Themes available: ${themes.length} (embedded into defaults.overview where applicable)`);

    await ds.query(`DELETE FROM workspace_tour_creation_presets WHERE workspace_id = $1 AND name LIKE 'دنالی-%'`, [wsId]);

    type Row = {
      sort_order: number;
      name: string;
      description: string | null;
      is_active: boolean;
      match_tour_type: string | null;
      match_main_tour_theme_id: string | null;
      defaults: Record<string, unknown>;
    };

    const rows: Row[] = [
      {
        sort_order: 10,
        name: "دنالی-۱ کوه + تم اصلی",
        description: "نوع کوهستانی و تم اصلی (در صورت وجود تم)",
        is_active: true,
        match_tour_type: "mountain",
        match_main_tour_theme_id: t0,
        defaults: {
          overview: { shortDescription: "پیش‌فرض کوهستانی با تم: آماده برای ویزارد ساخت تور." },
          participation: { requirements: "تجربهٔ کوهنوردی چندروزه الزامی است." },
          policies: { cancellationPolicy: "تا ۷ روز قبل: استرداد کامل جز کارمزد بانکی." },
        },
      },
      {
        sort_order: 20,
        name: "دنالی-۲ کوه بدون تم",
        description: "فقط تطبیق نوع کوهستان؛ بدون تم اصلی",
        is_active: true,
        match_tour_type: "mountain",
        match_main_tour_theme_id: null,
        defaults: {
          overview: { shortDescription: "قالب عمومی کوهستانی بدون تطبیق تم." },
          participation: { minParticipants: 6 },
        },
      },
      {
        sort_order: 30,
        name: "دنالی-۳ تم بدون نوع تور",
        description: "فقط تم اصلی؛ بدون matchTourType",
        is_active: true,
        match_tour_type: null,
        match_main_tour_theme_id: t0,
        defaults: {
          overview: { longDescription: "برنامهٔ پیشنهادی برای تورهایی که با همین تم اصلی ساخته می‌شوند." },
        },
      },
      {
        sort_order: 40,
        name: "دنالی-۴ بی‌نوع بی‌تم",
        description: "بدون تطبیق نوع و بدون تم — پیش‌فرض عمومی",
        is_active: true,
        match_tour_type: null,
        match_main_tour_theme_id: null,
        defaults: {
          logistics: { includedServices: "راهنما، هماهنگی حمل‌ونقل محلی (متن نمونه)" },
          overview: { shortDescription: "قالب عمومی بدون قید نوع یا تم." },
        },
      },
      {
        sort_order: 50,
        name: "دنالی-۵ شهر + تم دوم",
        description: "شهری با تم دوم در صورت وجود؛ وگرنه تم اول",
        is_active: true,
        match_tour_type: "city",
        match_main_tour_theme_id: t1,
        defaults: {
          overview: { shortDescription: "گشت شهری نیم‌روزه / تم روزانه پیشنهادی." },
          policies: { attendanceRules: "حضور دقیق در ایست تجمع الزامی است." },
        },
      },
      {
        sort_order: 60,
        name: "دنالی-۶ شهر بدون تم",
        description: "نوع شهری، بدون تم اصلی",
        is_active: true,
        match_tour_type: "city",
        match_main_tour_theme_id: null,
        defaults: {
          overview: { highlights: ["موزه", "بازار سنتی", "وقفهٔ چای"] },
        },
      },
      {
        sort_order: 70,
        name: "دنالی-۷ کویر بدون تم",
        description: "نوع کویری؛ بدون تم",
        is_active: false,
        match_tour_type: "desert",
        match_main_tour_theme_id: null,
        defaults: {
          logistics: { leaderInsuranceNotes: "پوشش بیمه‌ای نمونه — با واحد حقوقی هماهنگ کنید." },
          participation: { sportsInsuranceRequired: true },
        },
      },
      {
        sort_order: 80,
        name: "دنالی-۸ طبیعت + تم",
        description: "طبیعت‌گردی با تم اول در صورت وجود",
        is_active: true,
        match_tour_type: "nature",
        match_main_tour_theme_id: t0,
        defaults: {
          overview: { shortDescription: "پیمایش طبیعت، کمپ یا روستایی؛ پیش‌فرض متن." },
          participation: { suitableFor: ["علاقه‌مندان پیاده‌روی سبز"] },
        },
      },
      {
        sort_order: 90,
        name: "دنالی-۹ فرهنگی بدون تم",
        description: "نوع فرهنگی؛ بدون تم اصلی",
        is_active: true,
        match_tour_type: "cultural",
        match_main_tour_theme_id: null,
        defaults: {
          policies: {
            cancellationPolicy: "لغو تا ۴۸ ساعت قبل: استرداد ۸۰٪.",
            refundPolicy: "وجه تا ۵ روز کاری بازمی‌گردد.",
          },
        },
      },
      {
        sort_order: 100,
        name: "دنالی-۱۰ ترکیبی غیرفعال",
        description: "نمونه غیرفعال؛ برای تست مخفی شدن از انتخاب‌گرها",
        is_active: false,
        match_tour_type: "nature",
        match_main_tour_theme_id: null,
        defaults: {
          overview: { shortDescription: "این قالب غیرفعال است؛ در UI پیشنهاد نمی‌شود." },
        },
      },
    ];

    for (const row of rows) {
      const defaultsMerged = mergeLegacyMatchIntoDefaults(row.defaults, row.match_tour_type, row.match_main_tour_theme_id);
      await ds.query(
        `INSERT INTO workspace_tour_creation_presets
          (workspace_id, name, description, is_active, sort_order, match_tour_type, match_main_tour_theme_id, defaults)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)`,
        [wsId, row.name, row.description, row.is_active, row.sort_order, null, null, JSON.stringify(defaultsMerged)],
      );
    }

    emitScriptInfo(`Inserted ${rows.length} presets for denali (workspace_id=${wsId}).`);
  } finally {
    await ds.destroy();
  }
}

seedDenaliTourPresets().catch((error: unknown) => {
  console.error(
    "seed-denali-tour-presets failed:",
    error instanceof Error ? error.stack ?? error.message : String(error),
  );
  process.exitCode = 1;
});
