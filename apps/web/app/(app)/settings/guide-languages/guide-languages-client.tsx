"use client";

import { SettingsPageHeader } from "@/admin/patterns/settings-page-header";
import { useTranslations } from "next-intl";
import { Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

import type { OperatorSessionContext } from "@/admin/require-operator-session";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { isAdminOrOwnerRole } from "@/features/bookings/bookings-command-center-types";
import { resolveCodedErrorMessage } from "@/i18n/resolve-coded-error-message";
import {
  SETTINGS_HUB_TEST_IDS,
  type GuideLanguageResource,
  type GuideLanguagesListResponse,
} from "@/features/settings/settings-module-types";

type GuideLanguagesClientProps = {
  readonly session: OperatorSessionContext;
};

export function GuideLanguagesClient({ session }: GuideLanguagesClientProps) {
  const t = useTranslations("settings.guideLanguages");
  const tErrors = useTranslations("settings.errors");
  const tCommon = useTranslations("common");
  const tSettings = useTranslations("settings");
  const canManage = isAdminOrOwnerRole(session.role);
  const [items, setItems] = useState<readonly GuideLanguageResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [saving, setSaving] = useState(false);
  const [fetchNonce, setFetchNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void fetch("/api/settings/resources/guide_languages", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`GUIDE_LANGUAGES_HTTP_${response.status}`);
        }
        return (await response.json()) as GuideLanguagesListResponse;
      })
      .then((payload) => {
        if (!cancelled) {
          setItems(payload.items);
        }
      })
      .catch((fetchError: unknown) => {
        if (!cancelled) {
          setError(
            fetchError instanceof Error ? fetchError.message : "GUIDE_LANGUAGES_FETCH_FAILED"
          );
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
  }, [fetchNonce]);

  const refresh = () => setFetchNonce((value) => value + 1);

  const handleCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canManage || name.trim().length === 0) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/settings/resources/guide_languages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          ...(slug.trim().length > 0 ? { slug: slug.trim() } : {}),
        }),
      });
      if (!response.ok) {
        throw new Error(`GUIDE_LANGUAGES_CREATE_HTTP_${response.status}`);
      }
      setName("");
      setSlug("");
      refresh();
    } catch (createError: unknown) {
      setError(
        createError instanceof Error ? createError.message : "GUIDE_LANGUAGES_CREATE_FAILED"
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (itemId: string) => {
    if (!canManage) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/settings/resources/guide_languages/${itemId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error(`GUIDE_LANGUAGES_DELETE_HTTP_${response.status}`);
      }
      refresh();
    } catch (deleteError: unknown) {
      setError(
        deleteError instanceof Error ? deleteError.message : "GUIDE_LANGUAGES_DELETE_FAILED"
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6" data-testid={SETTINGS_HUB_TEST_IDS.guideLanguagesPage}>
      <SettingsPageHeader title={t("title")} description={t("subtitle")} />

      {canManage ? (
        <Card data-operator-surface="card" className="shadow-sm" data-testid={SETTINGS_HUB_TEST_IDS.guideLanguagesForm}>
          <CardHeader>
            <CardTitle>{t("addTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4 sm:grid-cols-3" onSubmit={(event) => void handleCreate(event)}>
              <div className="space-y-2 sm:col-span-1">
                <Label htmlFor="language-name">{tCommon("name")}</Label>
                <Input
                  id="language-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                />
              </div>
              <div className="space-y-2 sm:col-span-1">
                <Label htmlFor="language-slug">{t("slug")}</Label>
                <Input
                  id="language-slug"
                  value={slug}
                  onChange={(event) => setSlug(event.target.value)}
                  placeholder={tCommon("optional")}
                />
              </div>
              <div className="flex items-end sm:col-span-1">
                <Button type="submit" disabled={saving}>
                  <Plus className="me-1 size-4" />
                  {tCommon("add")}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      {loading ? <Skeleton className="h-32 w-full" /> : null}
      {error !== null ? (
        <p className="text-sm text-destructive">{resolveCodedErrorMessage(tErrors, error)}</p>
      ) : null}

      <Card data-operator-surface="card" className="shadow-sm" data-testid={SETTINGS_HUB_TEST_IDS.guideLanguagesList}>
        <CardHeader>
          <CardTitle>{t("listTitle", { count: items.length })}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("empty")}</p>
          ) : (
            items.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <div>
                  <p className="font-medium">{item.name}</p>
                  <p className="text-xs text-muted-foreground">{item.slug}</p>
                </div>
                {canManage ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={saving}
                    aria-label={tSettings("deleteItem", { name: item.name })}
                    onClick={() => void handleDelete(item.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                ) : null}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}