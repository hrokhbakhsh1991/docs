"use client";

import { useTranslations } from "next-intl";

import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@tour/ui";

import styles from "./settings-subnav.module.css";

export function SettingsSubnav() {
  const t = useTranslations("settings");
  const pathname = usePathname() ?? "";
  const profileActive = pathname === "/settings" || pathname === "/settings/";
  const locationsActive =
    pathname === "/settings/locations" || pathname.startsWith("/settings/locations/");
  const equipmentActive =
    pathname === "/settings/equipment" || pathname.startsWith("/settings/equipment/");
  const tourThemesActive =
    pathname === "/settings/tour-themes" || pathname.startsWith("/settings/tour-themes/");
  const guideLanguagesActive =
    pathname === "/settings/guide-languages" || pathname.startsWith("/settings/guide-languages/");
  const tourPresetsActive =
    pathname === "/settings/tour-presets" ||
    pathname.startsWith("/settings/tour-presets/") ||
    pathname === "/settings/tour-form-defaults" ||
    pathname.startsWith("/settings/tour-form-defaults/");

  return (
    <nav className={styles.root} aria-label={t("settingsSubnavAria")}>
      <Link href="/settings" className={cn(styles.link, profileActive && styles.linkActive)}>
        {t("settingsSubnavProfile")}
      </Link>
      <Link href="/settings/locations" className={cn(styles.link, locationsActive && styles.linkActive)}>
        {t("locationsSectionTitle")}
      </Link>
      <Link href="/settings/equipment" className={cn(styles.link, equipmentActive && styles.linkActive)}>
        {t("settingsSubnavEquipment")}
      </Link>
      <Link href="/settings/tour-themes" className={cn(styles.link, tourThemesActive && styles.linkActive)}>
        {t("settingsSubnavTourThemes")}
      </Link>
      <Link
        href="/settings/guide-languages"
        className={cn(styles.link, guideLanguagesActive && styles.linkActive)}
      >
        {t("settingsSubnavGuideLanguages")}
      </Link>
      <Link href="/settings/tour-presets" className={cn(styles.link, tourPresetsActive && styles.linkActive)}>
        {t("settingsSubnavTourFormDefaults")}
      </Link>
    </nav>
  );
}
