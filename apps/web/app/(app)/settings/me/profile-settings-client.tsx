"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import { OperatorProfileAvatar } from "@/admin/patterns/operator-profile-avatar";
import { SettingsPageHeader } from "@/admin/patterns/settings-page-header";
import type { OperatorSessionContext } from "@/admin/require-operator-session";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  removeOperatorAvatar,
  resolveOperatorAvatarPreviewUrl,
  uploadOperatorAvatar,
} from "@/features/settings/profile-avatar-client";
import {
  isProfileDisplayNameValid,
  type OperatorProfile,
} from "@/features/settings/profile-settings-logic";
import {
  OPERATOR_PROFILE_GENDERS,
  parseOperatorProfileGender,
} from "@/features/operator-profile/gender";
import { SETTINGS_HUB_TEST_IDS } from "@/features/settings/settings-module-types";
import { validateOperatorAvatarFile } from "@/features/settings/validate-operator-avatar-file";
import { resolveCodedErrorMessage } from "@/i18n/resolve-coded-error-message";

type ProfileSettingsClientProps = {
  readonly session: OperatorSessionContext;
  readonly initialProfile?: OperatorProfile | null;
};

export function ProfileSettingsClient({
  session,
  initialProfile = null,
}: ProfileSettingsClientProps) {
  const t = useTranslations("settings.profile");
  const tErrors = useTranslations("settings.errors");
  const tCommon = useTranslations("common");
  const [profile, setProfile] = useState<OperatorProfile | null>(initialProfile);
  const [displayName, setDisplayName] = useState(initialProfile?.displayName ?? "");
  const [gender, setGender] = useState(initialProfile?.gender ?? "");
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(
    initialProfile?.avatarUrl ?? null
  );
  const [loading, setLoading] = useState(initialProfile === null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const skipInitialFetchRef = useRef(initialProfile !== null);

  async function hydrateAvatarPreview(fromProfile: OperatorProfile | null): Promise<void> {
    if (fromProfile?.avatarUrl !== undefined && fromProfile.avatarUrl !== null) {
      setAvatarPreviewUrl(fromProfile.avatarUrl);
      return;
    }
    if (fromProfile?.avatarUrl === null) {
      setAvatarPreviewUrl(null);
      return;
    }
    const url = await resolveOperatorAvatarPreviewUrl().catch(() => null);
    setAvatarPreviewUrl(url);
  }

  useEffect(() => {
    if (skipInitialFetchRef.current) {
      skipInitialFetchRef.current = false;
      if (initialProfile !== null) {
        void hydrateAvatarPreview(initialProfile);
      }
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    void fetch("/api/identity/me", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`PROFILE_HTTP_${response.status}`);
        }
        return (await response.json()) as OperatorProfile;
      })
      .then(async (payload) => {
        if (!cancelled) {
          setProfile(payload);
          setDisplayName(payload.displayName);
          setGender(payload.gender ?? "");
          await hydrateAvatarPreview(payload);
        }
      })
      .catch((fetchError: unknown) => {
        if (!cancelled) {
          setError(fetchError instanceof Error ? fetchError.message : "PROFILE_FETCH_FAILED");
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

  const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isProfileDisplayNameValid(displayName)) {
      setError("PROFILE_DISPLAY_NAME_INVALID");
      return;
    }
    const parsedGender = parseOperatorProfileGender(gender);
    if (gender.trim().length > 0 && parsedGender === null) {
      setError("PROFILE_GENDER_INVALID");
      return;
    }
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const response = await fetch("/api/identity/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: displayName.trim(),
          gender: parsedGender,
        }),
      });
      if (!response.ok) {
        throw new Error(`PROFILE_SAVE_HTTP_${response.status}`);
      }
      const payload = (await response.json()) as OperatorProfile;
      setProfile(payload);
      setDisplayName(payload.displayName);
      setGender(payload.gender ?? "");
      setSaved(true);
    } catch (saveError: unknown) {
      setError(saveError instanceof Error ? saveError.message : "PROFILE_SAVE_FAILED");
    } finally {
      setSaving(false);
    }
  };

  async function handleAvatarSelected(file: File | undefined) {
    if (file === undefined) {
      return;
    }
    const validationCode = validateOperatorAvatarFile(file);
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
      const payload = await uploadOperatorAvatar(file);
      setProfile(payload);
      const url = await resolveOperatorAvatarPreviewUrl();
      setAvatarPreviewUrl(url);
      setSaved(true);
    } catch (uploadError: unknown) {
      setError(uploadError instanceof Error ? uploadError.message : "PROFILE_AVATAR_UPLOAD_FAILED");
    } finally {
      setUploading(false);
      if (fileInputRef.current !== null) {
        fileInputRef.current.value = "";
      }
    }
  }

  async function handleRemoveAvatar() {
    setUploading(true);
    setError(null);
    try {
      const payload = await removeOperatorAvatar();
      setProfile(payload);
      setAvatarPreviewUrl(null);
      setSaved(true);
    } catch (removeError: unknown) {
      setError(removeError instanceof Error ? removeError.message : "PROFILE_AVATAR_DELETE_FAILED");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-6" data-testid={SETTINGS_HUB_TEST_IDS.profilePage}>
      <SettingsPageHeader title={t("title")} description={t("subtitle")} />

      {loading ? (
        <Skeleton className="h-64 w-full max-w-xl" />
      ) : (
        <Card className="max-w-xl">
          <CardHeader>
            <CardTitle>{t("cardTitle")}</CardTitle>
            <CardDescription>
              {t("cardDescription", { workspaceType: session.workspaceType })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-4"
              data-testid={SETTINGS_HUB_TEST_IDS.profileForm}
              onSubmit={(event) => void handleSave(event)}
            >
              <div className="space-y-2">
                <Label>{t("avatarLabel")}</Label>
                <div className="flex flex-wrap items-center gap-4">
                  <OperatorProfileAvatar
                    userId={session.userId}
                    displayName={displayName}
                    avatarUrl={avatarPreviewUrl}
                    testId={SETTINGS_HUB_TEST_IDS.profileAvatar}
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={uploading || saving}
                      onClick={() => fileInputRef.current?.click()}
                      data-testid={SETTINGS_HUB_TEST_IDS.profileAvatarUpload}
                    >
                      {uploading ? t("avatarUploading") : t("avatarUpload")}
                    </Button>
                    {avatarPreviewUrl !== null ? (
                      <Button
                        type="button"
                        variant="outline"
                        disabled={uploading || saving}
                        onClick={() => void handleRemoveAvatar()}
                        data-testid={SETTINGS_HUB_TEST_IDS.profileAvatarRemove}
                      >
                        {t("avatarRemove")}
                      </Button>
                    ) : null}
                    <Input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="sr-only"
                      onChange={(event) => void handleAvatarSelected(event.target.files?.[0])}
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">{t("avatarHint")}</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="profile-display-name">{t("displayName")}</Label>
                <Input
                  id="profile-display-name"
                  value={displayName}
                  data-testid={SETTINGS_HUB_TEST_IDS.profileDisplayName}
                  onChange={(event) => {
                    setDisplayName(event.target.value);
                    setSaved(false);
                  }}
                  autoComplete="name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="profile-gender">{t("gender")}</Label>
                <select
                  id="profile-gender"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  data-testid={SETTINGS_HUB_TEST_IDS.profileGender}
                  value={gender}
                  onChange={(event) => {
                    setGender(event.target.value);
                    setSaved(false);
                  }}
                >
                  <option value="">{tCommon("gender.unset")}</option>
                  {OPERATOR_PROFILE_GENDERS.map((value) => (
                    <option key={value} value={value}>
                      {tCommon(`gender.${value}`)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="profile-mobile">{t("phone")}</Label>
                <Input id="profile-mobile" value={profile?.mobile ?? ""} readOnly disabled />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="profile-role">{t("role")}</Label>
                  <Input
                    id="profile-role"
                    value={profile?.role ?? session.role}
                    readOnly
                    disabled
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="profile-status">{t("status")}</Label>
                  <Input
                    id="profile-status"
                    value={profile?.status ?? "ACTIVE"}
                    readOnly
                    disabled
                  />
                </div>
              </div>

              {error !== null ? (
                <p className="text-sm text-destructive">
                  {resolveCodedErrorMessage(tErrors, error)}
                </p>
              ) : null}
              {saved ? <p className="text-sm text-muted-foreground">{t("saved")}</p> : null}

              <Button
                type="submit"
                disabled={saving || uploading || !isProfileDisplayNameValid(displayName)}
                data-testid={SETTINGS_HUB_TEST_IDS.profileSave}
              >
                {saving ? tCommon("saving") : t("saveButton")}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
