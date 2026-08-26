"use client";

import { SettingsPageHeader } from "@/admin/patterns/settings-page-header";
import { useTranslations } from "next-intl";
import { Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import {
  ensureSettingsEquipmentUiSurface,
} from "@/features/settings/settings-equipment-ui-registry";
import type { SettingsEquipmentUiSurface } from "@/features/settings/settings-equipment-ui-types";

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
  type TourThemeResource,
  type TourThemesListResponse,
} from "@/features/settings/settings-module-types";

type TourThemesClientProps = {
  readonly session: OperatorSessionContext;
};

export function TourThemesClient({ session }: TourThemesClientProps) {
  const [equipmentUi, setEquipmentUi] = useState<SettingsEquipmentUiSurface | null>(null);
  const [surfaceReady, setSurfaceReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void ensureSettingsEquipmentUiSurface(session.pluginId).then((surface) => {
      if (!cancelled) {
        setEquipmentUi(surface);
        setSurfaceReady(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [session.pluginId]);

  if (!surfaceReady) {
    return (
      <div className="space-y-4" data-testid={SETTINGS_HUB_TEST_IDS.tourThemesPage}>
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (equipmentUi == null) {
    throw new Error(`No equipment settings UI surface for plugin: ${session.pluginId}`);
  }

  return <TourThemesClientReady session={session} equipmentUi={equipmentUi} />;
}

function TourThemesClientReady({
  session,
  equipmentUi,
}: TourThemesClientProps & { readonly equipmentUi: SettingsEquipmentUiSurface }) {
  const { EquipmentIconPicker, TourThemeCatalogAvatar } = equipmentUi;
  const t = useTranslations("settings.tourThemes");
  const tErrors = useTranslations("settings.errors");
  const tCommon = useTranslations("common");
  const tSettings = useTranslations("settings");
  const canManage = isAdminOrOwnerRole(session.role);
  const [items, setItems] = useState<readonly TourThemeResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [iconKey, setIconKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [fetchNonce, setFetchNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void fetch("/api/settings/resources/tour_themes", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`TOUR_THEMES_HTTP_${response.status}`);
        }
        return (await response.json()) as TourThemesListResponse;
      })
      .then((payload) => {
        if (!cancelled) {
          setItems(payload.items);
        }
      })
      .catch((fetchError: unknown) => {
        if (!cancelled) {
          setError(fetchError instanceof Error ? fetchError.message : "TOUR_THEMES_FETCH_FAILED");
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
      const response = await fetch("/api/settings/resources/tour_themes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          ...(slug.trim().length > 0 ? { slug: slug.trim() } : {}),
          ...(iconKey != null ? { iconKey } : {}),
        }),
      });
      if (!response.ok) {
        throw new Error(`TOUR_THEMES_CREATE_HTTP_${response.status}`);
      }
      setName("");
      setSlug("");
      setIconKey(null);
      refresh();
    } catch (createError: unknown) {
      setError(createError instanceof Error ? createError.message : "TOUR_THEMES_CREATE_FAILED");
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
      const response = await fetch(`/api/settings/resources/tour_themes/${itemId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error(`TOUR_THEMES_DELETE_HTTP_${response.status}`);
      }
      refresh();
    } catch (deleteError: unknown) {
      setError(deleteError instanceof Error ? deleteError.message : "TOUR_THEMES_DELETE_FAILED");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6" data-testid={SETTINGS_HUB_TEST_IDS.tourThemesPage}>
      <SettingsPageHeader title={t("title")} description={t("subtitle")} />

      {canManage ? (
        <Card data-operator-surface="card" className="shadow-sm" data-testid={SETTINGS_HUB_TEST_IDS.tourThemesForm}>
          <CardHeader>
            <CardTitle>{t("addTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={(event) => void handleCreate(event)}>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="theme-name">{tCommon("name")}</Label>
                  <Input
                    id="theme-name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="theme-slug">{tCommon("slug")}</Label>
                  <Input
                    id="theme-slug"
                    value={slug}
                    onChange={(event) => setSlug(event.target.value)}
                    placeholder={tCommon("optional")}
                  />
                </div>
              </div>

              <EquipmentIconPicker
                name={name}
                value={iconKey}
                onChange={setIconKey}
                previewSubtitle={t("iconPreviewSubtitle")}
              />

              <Button type="submit" disabled={saving}>
                <Plus className="me-1 size-4" />
                {tCommon("add")}
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : null}

      {loading ? <Skeleton className="h-32 w-full" /> : null}
      {error !== null ? (
        <p className="text-sm text-destructive">{resolveCodedErrorMessage(tErrors, error)}</p>
      ) : null}

      <Card data-operator-surface="card" className="shadow-sm" data-testid={SETTINGS_HUB_TEST_IDS.tourThemesList}>
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
                data-tour-theme-list-row
              >
                <div className="flex min-w-0 items-center gap-3">
                  <TourThemeCatalogAvatar
                    id={item.id}
                    name={item.name}
                    iconKey={item.iconKey}
                    size="chip"
                  />
                  <div className="min-w-0">
                    <p className="font-medium">{item.name}</p>
                    <p className="text-xs text-muted-foreground">{item.slug}</p>
                  </div>
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
