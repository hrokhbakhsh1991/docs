"use client";

import {
  MARKETING_PAGE_LOCALES,
  parseMarketingHomeHeroPayload,
} from "@app-tour/marketing-pages-http-contracts";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";

import { SettingsPageHeader } from "@/admin/patterns/settings-page-header";
import { SettingsPageShell } from "@/admin/patterns/settings-page-shell";
import { OperatorSkeleton } from "@/admin/patterns/operator-skeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { OperatorSessionContext } from "@/admin/require-operator-session";
import { isAdminOrOwnerRole } from "@/features/bookings/bookings-command-center-types";
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

type MarketingPageLocale = (typeof MARKETING_PAGE_LOCALES)[number];

type FeedbackKind = "draft" | "published" | null;

export function MarketingPagesSettingsClient({ session }: MarketingPagesSettingsClientProps) {
  const t = useTranslations("settings.marketingPages");
  const tErrors = useTranslations("settings.errors");
  const canManage = isAdminOrOwnerRole(session.role);
  const [locale, setLocale] = useState<MarketingPageLocale>("fa");
  const [lead, setLead] = useState("");
  const [support, setSupport] = useState("");
  const [ctaPrimary, setCtaPrimary] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [publishedAt, setPublishedAt] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<FeedbackKind>(null);

  const loadPage = useCallback(async (activeLocale: MarketingPageLocale): Promise<void> => {
    setLoading(true);
    setError(null);
    setFeedback(null);
    try {
      const page = await fetchMarketingPageSettings(undefined, activeLocale);
      const source = page.draft ?? page.published;
      if (source !== null) {
        setLead(source.lead);
        setSupport(source.support);
        setCtaPrimary(source.ctaPrimary);
      } else {
        setLead("");
        setSupport("");
        setCtaPrimary("");
      }
      setPublishedAt(page.publishedAt);
    } catch (fetchError: unknown) {
      setError(fetchError instanceof Error ? fetchError.message : "MARKETING_PAGES_LOAD_FAILED");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPage(locale);
  }, [locale, loadPage]);

  function validateHeroForm(): boolean {
    try {
      parseMarketingHomeHeroPayload({ lead, support, ctaPrimary });
      return true;
    } catch {
      setError("MARKETING_PAGES_VALIDATION_REQUIRED");
      setFeedback(null);
      return false;
    }
  }

  async function handleSaveDraft(): Promise<void> {
    if (!canManage) {
      return;
    }
    if (!validateHeroForm()) {
      return;
    }
    setSaving(true);
    setError(null);
    setFeedback(null);
    try {
      const page = await saveMarketingPageDraft({ lead, support, ctaPrimary }, undefined, locale);
      setPublishedAt(page.publishedAt);
      setFeedback("draft");
    } catch (saveError: unknown) {
      setError(saveError instanceof Error ? saveError.message : "MARKETING_PAGES_SAVE_FAILED");
    } finally {
      setSaving(false);
    }
  }

  async function handlePublish(): Promise<void> {
    if (!canManage) {
      return;
    }
    if (!validateHeroForm()) {
      return;
    }
    setPublishing(true);
    setError(null);
    setFeedback(null);
    try {
      await saveMarketingPageDraft({ lead, support, ctaPrimary }, undefined, locale);
      const page = await publishMarketingPage(undefined, locale);
      setPublishedAt(page.publishedAt);
      setFeedback("published");
    } catch (publishError: unknown) {
      setError(publishError instanceof Error ? publishError.message : "MARKETING_PAGES_PUBLISH_FAILED");
    } finally {
      setPublishing(false);
    }
  }

  if (loading) {
    return (
      <SettingsPageShell testId={MARKETING_PAGES_SETTINGS_TEST_IDS.page}>
        <OperatorSkeleton size="panel-xl" />
      </SettingsPageShell>
    );
  }

  return (
    <SettingsPageShell
      testId={MARKETING_PAGES_SETTINGS_TEST_IDS.page}
      data-can-manage={canManage ? "true" : "false"}
    >
      <div className="space-y-6">
        <SettingsPageHeader title={t("title")} description={t("description")} />

        {!canManage ? (
          <p
            className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
            data-testid={MARKETING_PAGES_SETTINGS_TEST_IDS.readOnlyBanner}
          >
            {t("readOnlyBanner")}
          </p>
        ) : null}

        <div
          className="flex flex-wrap gap-2"
          role="tablist"
          aria-label={t("localeTabsLabel")}
          data-testid={MARKETING_PAGES_SETTINGS_TEST_IDS.localeTabs}
        >
          {MARKETING_PAGE_LOCALES.map((entry) => (
            <Button
              key={entry}
              type="button"
              size="sm"
              variant={locale === entry ? "default" : "outline"}
              role="tab"
              aria-selected={locale === entry}
              data-testid={MARKETING_PAGES_SETTINGS_TEST_IDS.localeTab(entry)}
              onClick={() => setLocale(entry)}
            >
              {entry === "fa" ? t("localeFa") : t("localeEn")}
            </Button>
          ))}
        </div>

        {publishedAt !== null ? (
          <p
            className="text-sm text-muted-foreground"
            data-testid={MARKETING_PAGES_SETTINGS_TEST_IDS.statusPublished}
          >
            {t("publishedAt", { date: new Date(publishedAt).toLocaleString(locale === "fa" ? "fa-IR" : "en-US") })}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">{t("notPublishedYet")}</p>
        )}

        {feedback === "draft" ? (
          <p className="text-sm text-muted-foreground" data-testid={MARKETING_PAGES_SETTINGS_TEST_IDS.savedDraft}>
            {t("draftSaved")}
          </p>
        ) : null}
        {feedback === "published" ? (
          <p
            className="text-sm text-muted-foreground"
            data-testid={MARKETING_PAGES_SETTINGS_TEST_IDS.savedPublished}
          >
            {t("publishedSuccess")}
          </p>
        ) : null}

        {error !== null ? (
          <Card
            data-operator-surface="card"
            className="shadow-sm"
            data-testid={
              error === "MARKETING_PAGES_VALIDATION_REQUIRED"
                ? MARKETING_PAGES_SETTINGS_TEST_IDS.validationError
                : undefined
            }
          >
            <CardContent className="pt-6 text-sm text-destructive">
              {error === "MARKETING_PAGES_VALIDATION_REQUIRED"
                ? t("validationRequired")
                : resolveCodedErrorMessage(tErrors, error)}
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
                readOnly={!canManage}
                disabled={!canManage}
                onChange={(event) => setLead(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="marketing-pages-support">{t("supportLabel")}</Label>
              <textarea
                id="marketing-pages-support"
                data-testid={MARKETING_PAGES_SETTINGS_TEST_IDS.supportInput}
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
                value={support}
                readOnly={!canManage}
                disabled={!canManage}
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
                readOnly={!canManage}
                disabled={!canManage}
                onChange={(event) => setCtaPrimary(event.target.value)}
              />
            </div>
            {canManage ? (
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
            ) : null}
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground">
          {t("actorHint", { role: session.role })}
        </p>
      </div>
    </SettingsPageShell>
  );
}
