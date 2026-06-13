"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { PageHeader } from "@/admin/patterns/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DenaliSkeleton } from "@/admin/patterns/denali-skeleton";
import {
  descriptionKeyForSettingsModule,
  groupSettingsModulesByNav,
  hrefForSettingsModule,
  kindLabelKeyForSettingsModule,
  labelKeyForSettingsModule,
} from "@/features/settings/settings-hub-logic";
import { resolveCodedErrorMessage } from "@/i18n/resolve-coded-error-message";
import {
  SETTINGS_HUB_TEST_IDS,
  type SettingsModulesListResponse,
} from "@/features/settings/settings-module-types";

export function SettingsHubClient({
  initialModules = null,
}: {
  readonly initialModules?: SettingsModulesListResponse | null;
}) {
  const t = useTranslations("settings");
  const tErrors = useTranslations("settings.errors");
  const [modules, setModules] = useState<SettingsModulesListResponse | null>(initialModules);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(initialModules === null);

  useEffect(() => {
    if (initialModules !== null) {
      return;
    }

    let cancelled = false;
    void fetch("/api/settings/modules", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`SETTINGS_MODULES_HTTP_${response.status}`);
        }
        return (await response.json()) as SettingsModulesListResponse;
      })
      .then((payload) => {
        if (!cancelled) {
          setModules(payload);
        }
      })
      .catch((fetchError: unknown) => {
        if (!cancelled) {
          setError(fetchError instanceof Error ? fetchError.message : "SETTINGS_MODULES_FAILED");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [initialModules]);

  const groups =
    modules === null ? [] : groupSettingsModulesByNav(modules.items);

  return (
    <div className="space-y-6" data-testid={SETTINGS_HUB_TEST_IDS.page}>
      <PageHeader title={t("hub.title")} description={t("hub.subtitle")} />

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          <DenaliSkeleton className="h-28 w-full rounded-xl" />
          <DenaliSkeleton className="h-28 w-full rounded-xl" />
        </div>
      ) : null}

      {error !== null ? (
        <Card data-denali-surface="card" className="shadow-sm">
          <CardContent className="pt-6 text-sm text-destructive">
            {resolveCodedErrorMessage(tErrors, error)}
          </CardContent>
        </Card>
      ) : null}

      {!loading && error === null
        ? groups.map((group) => (
            <section key={group.group} className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                {t(group.labelKey)}
              </h2>
              <div className="grid gap-4 md:grid-cols-2">
                {group.modules.map((module) => {
                  const descriptionKey = descriptionKeyForSettingsModule(module);
                  return (
                    <Card
                      key={module.id}
                      data-denali-surface="card"
                      data-testid={SETTINGS_HUB_TEST_IDS.moduleCard}
                      data-module-id={module.id}
                      className="shadow-sm transition-shadow"
                    >
                      <CardHeader>
                        <CardTitle>{t(labelKeyForSettingsModule(module))}</CardTitle>
                        <CardDescription>{t(kindLabelKeyForSettingsModule(module))}</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {descriptionKey !== null ? (
                          <p className="text-sm text-muted-foreground">{t(descriptionKey)}</p>
                        ) : null}
                        <Link
                          href={hrefForSettingsModule(module)}
                          className="text-sm font-medium text-primary hover:underline"
                        >
                          {t("hub.openModule")}
                        </Link>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </section>
          ))
        : null}
    </div>
  );
}