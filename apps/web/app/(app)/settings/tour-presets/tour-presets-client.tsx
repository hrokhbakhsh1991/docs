"use client";

import { SettingsPageHeader } from "@/admin/patterns/settings-page-header";
import Link from "next/link";
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
  type TourPresetResource,
  type TourPresetsListResponse,
  type TourThemeResource,
  type TourThemesListResponse,
} from "@/features/settings/settings-module-types";

type TourPresetsClientProps = {
  readonly session: OperatorSessionContext;
};

export function TourPresetsClient({ session }: TourPresetsClientProps) {
  const t = useTranslations("settings.tourPresets");
  const tErrors = useTranslations("settings.errors");
  const tCommon = useTranslations("common");
  const tSettings = useTranslations("settings");
  const canManage = isAdminOrOwnerRole(session.role);
  const [items, setItems] = useState<readonly TourPresetResource[]>([]);
  const [themes, setThemes] = useState<readonly TourThemeResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [themeId, setThemeId] = useState("");
  const [saving, setSaving] = useState(false);
  const [fetchNonce, setFetchNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void Promise.all([
      fetch("/api/settings/resources/tour_presets", { cache: "no-store" }),
      fetch("/api/settings/resources/tour_themes", { cache: "no-store" }),
    ])
      .then(async ([presetsRes, themesRes]) => {
        if (!presetsRes.ok) {
          throw new Error(`TOUR_PRESETS_HTTP_${presetsRes.status}`);
        }
        const presetsPayload = (await presetsRes.json()) as TourPresetsListResponse;
        const themesPayload =
          themesRes.ok ? ((await themesRes.json()) as TourThemesListResponse) : { items: [], total: 0 };
        return { presetsPayload, themesPayload };
      })
      .then(({ presetsPayload, themesPayload }) => {
        if (!cancelled) {
          setItems(presetsPayload.items);
          setThemes(themesPayload.items);
        }
      })
      .catch((fetchError: unknown) => {
        if (!cancelled) {
          setError(fetchError instanceof Error ? fetchError.message : "TOUR_PRESETS_FETCH_FAILED");
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
      const response = await fetch("/api/settings/resources/tour_presets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          ...(description.trim().length > 0 ? { description: description.trim() } : {}),
          ...(themeId.length > 0 ? { themeId } : {}),
        }),
      });
      if (!response.ok) {
        throw new Error(`TOUR_PRESETS_CREATE_HTTP_${response.status}`);
      }
      setName("");
      setDescription("");
      setThemeId("");
      refresh();
    } catch (createError: unknown) {
      setError(createError instanceof Error ? createError.message : "TOUR_PRESETS_CREATE_FAILED");
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
      const response = await fetch(`/api/settings/resources/tour_presets/${itemId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error(`TOUR_PRESETS_DELETE_HTTP_${response.status}`);
      }
      refresh();
    } catch (deleteError: unknown) {
      setError(deleteError instanceof Error ? deleteError.message : "TOUR_PRESETS_DELETE_FAILED");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6" data-testid={SETTINGS_HUB_TEST_IDS.tourPresetsPage}>
      <SettingsPageHeader title={t("title")} description={t("subtitle")} />

      {canManage ? (
        <Card data-denali-surface="card" className="shadow-sm" data-testid={SETTINGS_HUB_TEST_IDS.tourPresetsForm}>
          <CardHeader>
            <CardTitle>{t("addTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4 sm:grid-cols-4" onSubmit={(event) => void handleCreate(event)}>
              <div className="space-y-2 sm:col-span-1">
                <Label htmlFor="preset-name">{tCommon("name")}</Label>
                <Input
                  id="preset-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                />
              </div>
              <div className="space-y-2 sm:col-span-1">
                <Label htmlFor="preset-description">{tCommon("description")}</Label>
                <Input
                  id="preset-description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                />
              </div>
              <div className="space-y-2 sm:col-span-1">
                <Label htmlFor="preset-theme">{t("theme")}</Label>
                <select
                  id="preset-theme"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={themeId}
                  onChange={(event) => setThemeId(event.target.value)}
                >
                  <option value="">{t("noTheme")}</option>
                  {themes.map((theme) => (
                    <option key={theme.id} value={theme.id}>
                      {theme.name}
                    </option>
                  ))}
                </select>
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

      <Card data-denali-surface="card" className="shadow-sm" data-testid={SETTINGS_HUB_TEST_IDS.tourPresetsList}>
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
                  {item.description ? (
                    <p className="text-xs text-muted-foreground">{item.description}</p>
                  ) : null}
                  {item.themeId ? (
                    <p className="text-xs text-muted-foreground">
                      {t("themeLabel", {
                        name: themes.find((theme) => theme.id === item.themeId)?.name ?? item.themeId,
                      })}
                    </p>
                  ) : null}
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