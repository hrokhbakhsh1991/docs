import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { PageHeader } from "./page-header";

type SettingsPageHeaderProps = {
  readonly title: string;
  readonly description?: string;
  readonly backHref?: string;
  readonly backLabel?: string;
};

export function SettingsPageHeader({
  title,
  description,
  backHref = "/settings",
  backLabel,
}: SettingsPageHeaderProps) {
  const t = useTranslations("settings");
  const label = backLabel ?? t("backToHub");

  return (
    <div data-denali-settings-page-header>
      <Link href={backHref} data-denali-settings-back-link>
        <ArrowLeft aria-hidden data-denali-settings-back-icon />
        {label}
      </Link>
      <PageHeader title={title} description={description} />
    </div>
  );
}
