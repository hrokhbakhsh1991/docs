"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { SettingsPageHeader } from "@/admin/patterns/settings-page-header";
import { SettingsPageShell } from "@/admin/patterns/settings-page-shell";
import { OperatorSkeleton } from "@/admin/patterns/operator-skeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { OperatorSessionContext } from "@/admin/require-operator-session";
import {
  fetchMarketingPageSettings,
  publishMarketingPage,
  saveMarketingPageDraft,
} from "@/features/settings/marketing-pages-client";
import { MARKETING_PAGES_SETTINGS_TEST_IDS } from "@/features/settings/marketing-pages-types";
import { resolveCodedErrorMessage } from "@/i18n/resolve-coded-error-message";

type MarketingPagesSettingsClientProps = {
  readonly session: OperatorSessionContext;
};

export function MarketingPagesSettingsClient({ session }: MarketingPagesSettingsClientProps) {
  const t = useTranslations("settings.marketingPages");
  const tErrors = useTranslations("settings.errors");
  const [lead, setLead] = useState("");
  const [support, setSupport] = useState("");
  const [ctaPrimary, setCtaPrimary] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [publishedAt, setPublishedAt] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchMarketingPageSettings()
      .then((page) => {
        if (cancelled) {
          return;
        }
        const source = page.draft ?? page.published;
        if (source !== null) {
          setLead(source.lead);
          setSupport(source.support);
          setCtaPrimary(source.ctaPrimary);
        }
        setPublishedAt(page.publishedAt);
      })
      .catch((fetchError: unknown) => {
        if (!cancelled) {
          setError(fetchError instanceof Error ? fetchError.message : "MARKETING_PAGES_LOAD_FAILED");
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
  }, []);

  async function handleSaveDraft(): Promise<void> {
    setSaving(true);
    setError(null);
    try {
      const page = await saveMarketingPageDraft({ lead, support, ctaPrimary });
      setPublishedAt(page.publishedAt);
    } catch (saveError: unknown) {
      setError(saveError instanceof Error ? saveError.message : "MARKETING_PAGES_SAVE_FAILED");
    } finally {
      setSaving(false);
    }
  }

  async function handlePublish(): Promise<void> {
    setPublishing(true);
    setError(null);
    try {
      await saveMarketingPageDraft({ lead, support, ctaPrimary });
      const page = await publishMarketingPage();
      setPublishedAt(page.publishedAt);
    } catch (publishError: unknown) {
      setError(publishError instanceof Error ? publishError.message : "MARKETING_PAGES_PUBLISH_FAILED");
    } finally {
      setPublishing(false);
    }
  }

  if (loading) {
    return (
      <SettingsPageShell>
        <OperatorSkeleton size="settings-page" />
      </SettingsPageShell>
    );
  }

  return (
    <SettingsPageShell>
      <div className="space-y-6" data-testid={MARKETING_PAGES_SETTINGS_TEST_IDS.page}>
        <SettingsPageHeader title={t("title")} description={t("description")} />

        {publishedAt !== null ? (
          <p
            className="text-sm text-muted-foreground"
            data-testid={MARKETING_PAGES_SETTINGS_TEST_IDS.statusPublished}
          >
            {t("publishedAt", { date: new Date(publishedAt).toLocaleString("fa-IR") })}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">{t("notPublishedYet")}</p>
        )}

        {error !== null ? (
          <Card data-operator-surface="card" className="shadow-sm">
            <CardContent className="pt-6 text-sm text-destructive">
              {resolveCodedErrorMessage(tErrors, error)}
            </CardContent>
          </Card>
        ) : null}

        <Card data-operator-surface="card" className="shadow-sm">
          <CardHeader>
            <CardTitle>{t("homeHeroTitle")}</CardTitle>
            <CardDescription>{t("homeHeroDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="marketing-pages-lead">{t("leadLabel")}</Label>
              <Input
                id="marketing-pages-lead"
                data-testid={MARKETING_PAGES_SETTINGS_TEST_IDS.leadInput}
                value={lead}
                onChange={(event) => setLead(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="marketing-pages-support">{t("supportLabel")}</Label>
              <textarea
                id="marketing-pages-support"
                data-testid={MARKETING_PAGES_SETTINGS_TEST_IDS.supportInput}
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm"
                value={support}
                onChange={(event) => setSupport(event.target.value)}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="marketing-pages-cta">{t("ctaLabel")}</Label>
              <Input
                id="marketing-pages-cta"
                data-testid={MARKETING_PAGES_SETTINGS_TEST_IDS.ctaInput}
                value={ctaPrimary}
                onChange={(event) => setCtaPrimary(event.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                variant="secondary"
                data-testid={MARKETING_PAGES_SETTINGS_TEST_IDS.saveDraft}
                disabled={saving || publishing}
                onClick={() => void handleSaveDraft()}
              >
                {saving ? t("saving") : t("saveDraft")}
              </Button>
              <Button
                type="button"
                data-testid={MARKETING_PAGES_SETTINGS_TEST_IDS.publish}
                disabled={saving || publishing}
                onClick={() => void handlePublish()}
              >
                {publishing ? t("publishing") : t("publish")}
              </Button>
            </div>
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground">
          {t("actorHint", { role: session.role })}
        </p>
      </div>
    </SettingsPageShell>
  );
}
