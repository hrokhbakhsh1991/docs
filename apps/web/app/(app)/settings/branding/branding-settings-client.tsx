"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowLeft } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { SettingsPageHeader } from "@/admin/patterns/settings-page-header";
import { TenantBrandMark } from "@/admin/shell/tenant-brand-mark";
import type { OperatorSessionContext } from "@/admin/require-operator-session";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OperatorSkeleton } from "@/admin/patterns/operator-skeleton";
import { isAdminOrOwnerRole } from "@/features/bookings/bookings-command-center-types";
import { BRANDING_SETTINGS_TEST_IDS } from "@/features/settings/branding-types";
import type { TenantBrandingServerPrefetch } from "@/features/settings/fetch-tenant-branding.server";
import {
  fetchTenantBranding,
  patchTenantBrandingDisplayNames,
  removeTenantBrandLogo,
  resolveTenantBrandLogoPreviewUrl,
  uploadTenantBrandLogo,
} from "@/features/settings/tenant-brand-logo-client";
import { resolveCodedErrorMessage } from "@/i18n/resolve-coded-error-message";
import { useTenantBrandingOptional } from "@/tenant/tenant-branding-context";
import { validateTenantBrandLogoFile } from "@/features/settings/validate-tenant-brand-logo-file";

function resolveLocalizedBrandName(
  localizedValue: string | null | undefined,
  otherLocalizedValue: string | null | undefined,
  legacyValue: string | null | undefined
): string {
  return (
    localizedValue?.trim() ||
    otherLocalizedValue?.trim() ||
    legacyValue?.trim() ||
    ""
  );
}

type BrandingSettingsClientProps = {
  readonly session: OperatorSessionContext;
  readonly pluginId: string;
  readonly initialBranding?: TenantBrandingServerPrefetch | null;
};

export function BrandingSettingsClient({
  session,
  pluginId,
  initialBranding = null,
}: BrandingSettingsClientProps) {
  const t = useTranslations("settings.branding");
  const tErrors = useTranslations("settings.errors");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const brandingContext = useTenantBrandingOptional();
  const canManage = isAdminOrOwnerRole(session.role);
  const [legacyDisplayName, setLegacyDisplayName] = useState(
    initialBranding?.branding.displayName ?? ""
  );
  const [displayNameFa, setDisplayNameFa] = useState(
    resolveLocalizedBrandName(
      initialBranding?.branding.displayNameFa,
      initialBranding?.branding.displayNameEn,
      initialBranding?.branding.displayName
    )
  );
  const [displayNameEn, setDisplayNameEn] = useState(
    resolveLocalizedBrandName(
      initialBranding?.branding.displayNameEn,
      initialBranding?.branding.displayNameFa,
      initialBranding?.branding.displayName
    )
  );
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(
    initialBranding?.logoPreviewUrl ?? null
  );
  const [loading, setLoading] = useState(initialBranding === null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const skipInitialFetchRef = useRef(initialBranding !== null);

  const workspaceLabel = session.workspaceType;

  function notifyBrandingChanged(patch?: {
    readonly displayNameFa?: string | null;
    readonly displayNameEn?: string | null;
    readonly displayName?: string | null;
    readonly logoUrl?: string | null;
  }): void {
    brandingContext?.invalidateBranding(patch);
    router.refresh();
  }

  useEffect(() => {
    if (skipInitialFetchRef.current) {
      skipInitialFetchRef.current = false;
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    void fetchTenantBranding()
      .then(async (branding) => {
        if (cancelled) {
          return;
        }
        setLegacyDisplayName(branding.displayName ?? "");
        setDisplayNameFa(
          resolveLocalizedBrandName(branding.displayNameFa, branding.displayNameEn, branding.displayName)
        );
        setDisplayNameEn(
          resolveLocalizedBrandName(branding.displayNameEn, branding.displayNameFa, branding.displayName)
        );
        if (branding.logo?.storageKey) {
          const url = await resolveTenantBrandLogoPreviewUrl();
          if (!cancelled) {
            setLogoPreviewUrl(url);
          }
        } else {
          setLogoPreviewUrl(null);
        }
      })
      .catch((fetchError: unknown) => {
        if (!cancelled) {
          setError(fetchError instanceof Error ? fetchError.message : "BRANDING_FETCH_FAILED");
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

  async function handleSaveDisplayName() {
    if (!canManage) {
      return;
    }
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const branding = await patchTenantBrandingDisplayNames({
        displayNameFa: displayNameFa.trim().length > 0 ? displayNameFa.trim() : null,
        displayNameEn: displayNameEn.trim().length > 0 ? displayNameEn.trim() : null,
      });
      const nextDisplayNameFa = resolveLocalizedBrandName(
        branding.displayNameFa,
        branding.displayNameEn,
        branding.displayName
      );
      const nextDisplayNameEn = resolveLocalizedBrandName(
        branding.displayNameEn,
        branding.displayNameFa,
        branding.displayName
      );
      setLegacyDisplayName(branding.displayName ?? "");
      setDisplayNameFa(nextDisplayNameFa);
      setDisplayNameEn(nextDisplayNameEn);
      setSaved(true);
      notifyBrandingChanged({
        displayNameFa: nextDisplayNameFa,
        displayNameEn: nextDisplayNameEn,
        displayName: branding.displayName ?? null,
      });
    } catch (saveError: unknown) {
      setError(saveError instanceof Error ? saveError.message : "BRANDING_SAVE_FAILED");
    } finally {
      setSaving(false);
    }
  }

  async function handleLogoSelected(file: File | undefined) {
    if (!canManage || file === undefined) {
      return;
    }
    const validationCode = validateTenantBrandLogoFile(file);
    if (validationCode !== null) {
      setError(validationCode);
      setSaved(false);
      if (fileInputRef.current !== null) {
        fileInputRef.current.value = "";
      }
      return;
    }
    setUploading(true);
    setError(null);
    setSaved(false);
    try {
      await uploadTenantBrandLogo(file);
      const url = await resolveTenantBrandLogoPreviewUrl();
      setLogoPreviewUrl(url);
      setSaved(true);
      notifyBrandingChanged({ logoUrl: url });
    } catch (uploadError: unknown) {
      setError(uploadError instanceof Error ? uploadError.message : "BRANDING_LOGO_UPLOAD_FAILED");
    } finally {
      setUploading(false);
      if (fileInputRef.current !== null) {
        fileInputRef.current.value = "";
      }
    }
  }

  async function handleRemoveLogo() {
    if (!canManage) {
      return;
    }
    setUploading(true);
    setError(null);
    try {
      await removeTenantBrandLogo();
      setLogoPreviewUrl(null);
      setSaved(true);
      notifyBrandingChanged({ logoUrl: null });
    } catch (removeError: unknown) {
      setError(removeError instanceof Error ? removeError.message : "BRANDING_LOGO_DELETE_FAILED");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div
      className="space-y-6"
      data-testid={BRANDING_SETTINGS_TEST_IDS.page}
      data-can-manage={canManage ? "true" : "false"}
    >
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/settings">
            <ArrowLeft className="h-4 w-4" />
            {tCommon("back")}
          </Link>
        </Button>
      </div>

      <SettingsPageHeader title={t("title")} description={t("description")} />

      {!canManage ? (
        <p
          className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
          data-testid={BRANDING_SETTINGS_TEST_IDS.readOnlyBanner}
        >
          {t("readOnlyBanner")}
        </p>
      ) : null}

      {loading ? (
        <OperatorSkeleton size="panel-xl" />
      ) : (
        <Card data-operator-surface="card" className="shadow-sm">
          <CardHeader>
            <CardTitle>{t("logoSectionTitle")}</CardTitle>
            <CardDescription>{t("logoSectionDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-3 rounded-xl border bg-muted/20 p-3 sm:grid-cols-2">
              <div
                className="flex items-center gap-3 rounded-lg border bg-background px-3 py-2 shadow-sm"
                data-testid={BRANDING_SETTINGS_TEST_IDS.previewFa}
              >
                <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg border bg-muted/40">
                  {logoPreviewUrl !== null ? (
                    <img
                      src={logoPreviewUrl}
                      alt={t("logoPreviewAlt")}
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <TenantBrandMark
                      pluginId={pluginId}
                      workspaceLabel={displayNameFa.trim() || displayNameEn.trim() || workspaceLabel}
                      className="h-6 w-6"
                      preferLogo={false}
                    />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">FA</p>
                  <p className="truncate text-sm font-semibold">
                    {displayNameFa.trim() || displayNameEn.trim() || legacyDisplayName || workspaceLabel}
                  </p>
                </div>
              </div>
              <div
                className="flex items-center gap-3 rounded-lg border bg-background px-3 py-2 shadow-sm"
                data-testid={BRANDING_SETTINGS_TEST_IDS.previewEn}
              >
                <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg border bg-muted/40">
                  {logoPreviewUrl !== null ? (
                    <img
                      src={logoPreviewUrl}
                      alt={t("logoPreviewAlt")}
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <TenantBrandMark
                      pluginId={pluginId}
                      workspaceLabel={displayNameEn.trim() || displayNameFa.trim() || workspaceLabel}
                      className="h-6 w-6"
                      preferLogo={false}
                    />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">EN</p>
                  <p className="truncate text-sm font-semibold">
                    {displayNameEn.trim() || displayNameFa.trim() || legacyDisplayName || workspaceLabel}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-xl border bg-muted/40">
                {logoPreviewUrl !== null ? (
                  <img
                    src={logoPreviewUrl}
                    alt={t("logoPreviewAlt")}
                    className="h-full w-full object-contain"
                    data-testid={BRANDING_SETTINGS_TEST_IDS.logoPreview}
                  />
                ) : (
                  <TenantBrandMark
                    pluginId={pluginId}
                    workspaceLabel={workspaceLabel}
                    className="h-10 w-10"
                    preferLogo={false}
                  />
                )}
              </div>
              {canManage ? (
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={uploading}
                    onClick={() => fileInputRef.current?.click()}
                    data-testid={BRANDING_SETTINGS_TEST_IDS.logoUpload}
                  >
                    {uploading ? t("uploading") : t("uploadLogo")}
                  </Button>
                  {logoPreviewUrl !== null ? (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={uploading}
                      onClick={() => void handleRemoveLogo()}
                      data-testid={BRANDING_SETTINGS_TEST_IDS.logoRemove}
                    >
                      {t("removeLogo")}
                    </Button>
                  ) : null}
                  <Input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="sr-only"
                    onChange={(event) => void handleLogoSelected(event.target.files?.[0])}
                  />
                </div>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="branding-display-name-fa">{t("displayNameFaLabel")}</Label>
              <Input
                id="branding-display-name-fa"
                value={displayNameFa}
                onChange={(event) => setDisplayNameFa(event.target.value)}
                maxLength={80}
                readOnly={!canManage}
                disabled={!canManage}
                data-testid={BRANDING_SETTINGS_TEST_IDS.displayName}
              />
              <p className="text-xs text-muted-foreground">{t("displayNameHelper")}</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="branding-display-name-en">{t("displayNameEnLabel")}</Label>
              <Input
                id="branding-display-name-en"
                value={displayNameEn}
                onChange={(event) => setDisplayNameEn(event.target.value)}
                maxLength={80}
                readOnly={!canManage}
                disabled={!canManage}
                data-testid={BRANDING_SETTINGS_TEST_IDS.displayNameEn}
              />
              <p className="text-xs text-muted-foreground">{t("displayNameHelper")}</p>
            </div>

            {error !== null ? (
              <p className="text-sm text-destructive" role="alert">
                {resolveCodedErrorMessage(tErrors, error)}
              </p>
            ) : null}
            {saved ? <p className="text-sm text-muted-foreground">{t("saved")}</p> : null}

            {canManage ? (
              <Button
                type="button"
                onClick={() => void handleSaveDisplayName()}
                disabled={saving}
                data-testid={BRANDING_SETTINGS_TEST_IDS.save}
              >
                {saving ? t("saving") : t("saveDisplayNames")}
              </Button>
            ) : null}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
