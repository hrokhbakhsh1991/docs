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
    <div className="mb-6 space-y-4 md:mb-8">
      <Link
        href={backHref}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        {label}
      </Link>
      <PageHeader title={title} description={description} />
    </div>
  );
}
