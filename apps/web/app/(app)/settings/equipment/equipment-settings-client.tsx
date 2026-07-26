"use client";

import { SettingsPageHeader } from "@/admin/patterns/settings-page-header";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  ensureSettingsEquipmentUiSurface,
} from "@/features/settings/settings-equipment-ui-registry";
import type { SettingsEquipmentUiSurface } from "@/features/settings/settings-equipment-ui-types";
import { Checkbox } from "@app-tour/ui-primitives/checkbox";

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
  type EquipmentResource,
  type SettingsResourceListResponse,
  type TourThemeResource,
  type TourThemesListResponse,
} from "@/features/settings/settings-module-types";

type EquipmentSettingsClientProps = {
  readonly session: OperatorSessionContext;
};

export function EquipmentSettingsClient({ session }: EquipmentSettingsClientProps) {
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
      <div className="space-y-4" data-testid={SETTINGS_HUB_TEST_IDS.equipmentPage}>
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (equipmentUi == null) {
    throw new Error(`No equipment settings UI surface for plugin: ${session.pluginId}`);
  }

  return <EquipmentSettingsClientReady session={session} equipmentUi={equipmentUi} />;
}

function EquipmentSettingsClientReady({
  session,
  equipmentUi,
}: EquipmentSettingsClientProps & { readonly equipmentUi: SettingsEquipmentUiSurface }) {
  const { EquipmentCatalogAvatar, EquipmentIconPicker } = equipmentUi;
  const t = useTranslations("settings.equipment");
  const tErrors = useTranslations("settings.errors");
  const tCommon = useTranslations("common");
  const canManage = isAdminOrOwnerRole(session.role);
  const [items, setItems] = useState<readonly EquipmentResource[]>([]);
  const [themes, setThemes] = useState<readonly TourThemeResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [themesLoading, setThemesLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [iconKey, setIconKey] = useState<string | null>(null);
  const [selectedThemeIds, setSelectedThemeIds] = useState<readonly string[]>([]);
  const [saving, setSaving] = useState(false);
  const [fetchNonce, setFetchNonce] = useState(0);

  const themesById = useMemo(
    () => new Map(themes.map((theme) => [theme.id, theme] as const)),
    [themes]
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void fetch("/api/settings/resources/equipment", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`EQUIPMENT_LIST_HTTP_${response.status}`);
        }
        return (await response.json()) as SettingsResourceListResponse;
      })
      .then((payload) => {
        if (!cancelled) {
          setItems(payload.items);
        }
      })
      .catch((fetchError: unknown) => {
        if (!cancelled) {
          setError(fetchError instanceof Error ? fetchError.message : "EQUIPMENT_FETCH_FAILED");
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

  useEffect(() => {
    let cancelled = false;
    setThemesLoading(true);
    void fetch("/api/settings/resources/tour_themes", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`TOUR_THEMES_HTTP_${response.status}`);
        }
        return (await response.json()) as TourThemesListResponse;
      })
      .then((payload) => {
        if (!cancelled) {
          setThemes((payload.items ?? []).filter((theme) => theme.isActive));
        }
      })
      .catch((fetchError: unknown) => {
        if (!cancelled) {
          setError(fetchError instanceof Error ? fetchError.message : "TOUR_THEMES_LOAD_FAILED");
          setThemes([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setThemesLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const refresh = () => setFetchNonce((value) => value + 1);

  const toggleTheme = (themeId: string, checked: boolean) => {
    setSelectedThemeIds((current) =>
      checked ? [...current, themeId] : current.filter((id) => id !== themeId)
    );
  };

  const resolveThemeLabels = (themeIds: readonly string[]) =>
    themeIds
      .map((id) => themesById.get(id)?.name)
      .filter((label): label is string => label !== undefined && label.length > 0);

  const previewSubtitle = useMemo(() => {
    const themeLabels = resolveThemeLabels(selectedThemeIds);
    if (themeLabels.length > 0) {
      return themeLabels.join("، ");
    }
    return t("allThemes");
  }, [selectedThemeIds, themesById, t]);

  const handleCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canManage || name.trim().length === 0) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/settings/resources/equipment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          themeIds: selectedThemeIds,
          ...(iconKey !== null ? { iconKey } : {}),
        }),
      });
      if (!response.ok) {
        throw new Error(`EQUIPMENT_CREATE_HTTP_${response.status}`);
      }
      setName("");
      setIconKey(null);
      setSelectedThemeIds([]);
      refresh();
    } catch (createError: unknown) {
      setError(createError instanceof Error ? createError.message : "EQUIPMENT_CREATE_FAILED");
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
      const response = await fetch(`/api/settings/resources/equipment/${itemId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error(`EQUIPMENT_DELETE_HTTP_${response.status}`);
      }
      refresh();
    } catch (deleteError: unknown) {
      setError(deleteError instanceof Error ? deleteError.message : "EQUIPMENT_DELETE_FAILED");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6" data-testid={SETTINGS_HUB_TEST_IDS.equipmentPage}>
      <SettingsPageHeader title={t("title")} description={t("subtitle")} />

      {canManage ? (
        <Card data-operator-surface="card" className="shadow-sm" data-testid={SETTINGS_HUB_TEST_IDS.equipmentForm}>
          <CardHeader>
            <CardTitle>{t("addTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={(event) => void handleCreate(event)}>
              <div className="space-y-2">
                <Label htmlFor="equipment-name">{tCommon("name")}</Label>
                <Input
                  id="equipment-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                />
              </div>

              <EquipmentIconPicker
                name={name}
                value={iconKey}
                onChange={setIconKey}
                previewSubtitle={previewSubtitle}
              />

              <div className="space-y-2">
                <Label>{t("themes")}</Label>
                <p className="text-xs text-muted-foreground">{t("themesHint")}</p>
                {themesLoading ? <Skeleton className="h-20 w-full" /> : null}
                {!themesLoading && themes.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {t("noThemes")}{" "}
                    <Link href="/settings/tour-themes" className="text-primary underline-offset-4 hover:underline">
                      {t("themesLink")}
                    </Link>
                  </p>
                ) : null}
                {!themesLoading && themes.length > 0 ? (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {themes.map((theme) => (
                      <label
                        key={theme.id}
                        className="flex items-center gap-2 rounded-md border p-2 text-sm"
                      >
                        <Checkbox
                          aria-label={theme.name}
                          checked={selectedThemeIds.includes(theme.id)}
                          onChange={(event) => toggleTheme(theme.id, event.target.checked)}
                        />
                        <span>{theme.name}</span>
                      </label>
                    ))}
                  </div>
                ) : null}
              </div>

              <Button
                type="submit"
                disabled={saving}
                data-testid={SETTINGS_HUB_TEST_IDS.equipmentCreate}
              >
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

      <Card data-operator-surface="card" className="shadow-sm" data-testid={SETTINGS_HUB_TEST_IDS.equipmentList}>
        <CardHeader>
          <CardTitle>{t("catalogTitle", { count: items.length })}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("empty")}</p>
          ) : (
            items.map((item) => {
              const themeLabels = resolveThemeLabels(item.themeIds ?? []);
              return (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <EquipmentCatalogAvatar
                      id={item.id}
                      name={item.name}
                      iconKey={item.iconKey}
                    />
                    <div className="min-w-0">
                      <p className="font-medium">{item.name}</p>
                      {themeLabels.length > 0 ? (
                        <p className="text-xs text-muted-foreground">{themeLabels.join("، ")}</p>
                      ) : (
                        <p className="text-xs text-muted-foreground">{t("allThemes")}</p>
                      )}
                    </div>
                  </div>
                  {canManage ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={saving}
                      aria-label={t("deleteItem", { name: item.name })}
                      onClick={() => void handleDelete(item.id)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  ) : null}
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
