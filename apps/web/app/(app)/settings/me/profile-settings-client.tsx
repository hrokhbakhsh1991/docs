"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";

import { SettingsPageHeader } from "@/admin/patterns/settings-page-header";
import type { OperatorSessionContext } from "@/admin/require-operator-session";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  isProfileDisplayNameValid,
  type OperatorProfile,
} from "@/features/settings/profile-settings-logic";
import { SETTINGS_HUB_TEST_IDS } from "@/features/settings/settings-module-types";
import { resolveCodedErrorMessage } from "@/i18n/resolve-coded-error-message";

type ProfileSettingsClientProps = {
  readonly session: OperatorSessionContext;
};

export function ProfileSettingsClient({ session }: ProfileSettingsClientProps) {
  const t = useTranslations("settings.profile");
  const tErrors = useTranslations("settings.errors");
  const tCommon = useTranslations("common");
  const [profile, setProfile] = useState<OperatorProfile | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
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
      .then((payload) => {
        if (!cancelled) {
          setProfile(payload);
          setDisplayName(payload.displayName);
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
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const response = await fetch("/api/identity/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: displayName.trim() }),
      });
      if (!response.ok) {
        throw new Error(`PROFILE_SAVE_HTTP_${response.status}`);
      }
      const payload = (await response.json()) as OperatorProfile;
      setProfile(payload);
      setDisplayName(payload.displayName);
      setSaved(true);
    } catch (saveError: unknown) {
      setError(saveError instanceof Error ? saveError.message : "PROFILE_SAVE_FAILED");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6" data-testid={SETTINGS_HUB_TEST_IDS.profilePage}>
      <SettingsPageHeader title={t("title")} description={t("subtitle")} />

      {loading ? (
        <Skeleton className="h-64 w-full max-w-xl" />
      ) : (
        <Card className="max-w-xl">
          <CardHeader>
            <CardTitle>{t("cardTitle")}</CardTitle>
            <CardDescription>{t("cardDescription", { workspaceType: session.workspaceType })}</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-4"
              data-testid={SETTINGS_HUB_TEST_IDS.profileForm}
              onSubmit={(event) => void handleSave(event)}
            >
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
                <Label htmlFor="profile-mobile">{t("phone")}</Label>
                <Input id="profile-mobile" value={profile?.mobile ?? ""} readOnly disabled />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="profile-role">{t("role")}</Label>
                  <Input id="profile-role" value={profile?.role ?? session.role} readOnly disabled />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="profile-status">{t("status")}</Label>
                  <Input id="profile-status" value={profile?.status ?? "ACTIVE"} readOnly disabled />
                </div>
              </div>

              {error !== null ? (
                <p className="text-sm text-destructive">{resolveCodedErrorMessage(tErrors, error)}</p>
              ) : null}
              {saved ? <p className="text-sm text-muted-foreground">{t("saved")}</p> : null}

              <Button
                type="submit"
                disabled={saving || !isProfileDisplayNameValid(displayName)}
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