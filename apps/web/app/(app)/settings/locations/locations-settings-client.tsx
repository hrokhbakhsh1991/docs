"use client";

import { SettingsPageHeader } from "@/admin/patterns/settings-page-header";
import { useTranslations } from "next-intl";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

import type { OperatorSessionContext } from "@/admin/require-operator-session";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { isAdminOrOwnerRole } from "@/features/bookings/bookings-command-center-types";
import { ensureSettingsDestinationSurface } from "@/features/settings/settings-destination-registry";
import {
  buildDestinationCreateBody,
  buildDestinationPatchBody,
  destinationFormDraftFromResource,
  destinationLocationTypesForPlugin,
  destinationMetadataFieldsForForm,
  EMPTY_DESTINATION_FORM_DRAFT,
  formatDestinationMetadataSummary,
  type DestinationFormDraft,
  type DestinationLocationType,
} from "@/features/settings/destination-form-logic";
import { parseLocationsResponse } from "@/features/settings/locations-logic";
import { resolveCodedErrorMessage } from "@/i18n/resolve-coded-error-message";
import {
  SETTINGS_HUB_TEST_IDS,
  type DestinationResource,
  type RegionResource,
} from "@/features/settings/settings-module-types";

type LocationsSettingsClientProps = {
  readonly session: OperatorSessionContext;
};

function DestinationMetadataFields({
  draft,
  onChange,
  t,
  pluginId,
}: {
  readonly draft: DestinationFormDraft;
  readonly onChange: (next: DestinationFormDraft) => void;
  readonly t: ReturnType<typeof useTranslations<"settings.locations">>;
  readonly pluginId: string;
}) {
  const metadataFields = destinationMetadataFieldsForForm(draft.locationType, pluginId);
  if (metadataFields.length === 0) {
    return null;
  }
  return (
    <>
      {metadataFields.includes("altitudeM") ? (
        <div className="space-y-2">
          <Label htmlFor="destination-altitude">{t("altitudeM")}</Label>
          <Input
            id="destination-altitude"
            inputMode="numeric"
            value={draft.altitudeM}
            onChange={(event) => onChange({ ...draft, altitudeM: event.target.value })}
          />
          <p className="text-xs text-muted-foreground">{t("altitudeMHint")}</p>
        </div>
      ) : null}
      {metadataFields.includes("typicalTrailDistanceKm") ? (
        <div className="space-y-2">
          <Label htmlFor="destination-trail-distance">{t("typicalTrailDistanceKm")}</Label>
          <Input
            id="destination-trail-distance"
            inputMode="decimal"
            step="0.1"
            value={draft.typicalTrailDistanceKm}
            onChange={(event) => onChange({ ...draft, typicalTrailDistanceKm: event.target.value })}
          />
          <p className="text-xs text-muted-foreground">{t("typicalTrailDistanceKmHint")}</p>
        </div>
      ) : null}
    </>
  );
}

export function LocationsSettingsClient({ session }: LocationsSettingsClientProps) {
  const pluginId = session.pluginId;
  const [destinationLocationTypes, setDestinationLocationTypes] = useState<
    ReturnType<typeof destinationLocationTypesForPlugin> | null
  >(null);
  const [surfaceReady, setSurfaceReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void ensureSettingsDestinationSurface(pluginId).then((surface) => {
      if (cancelled) {
        return;
      }
      if (surface == null) {
        setDestinationLocationTypes(null);
      } else {
        setDestinationLocationTypes(destinationLocationTypesForPlugin(pluginId));
      }
      setSurfaceReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [pluginId]);

  if (!surfaceReady || destinationLocationTypes == null) {
    return (
      <div className="space-y-4" data-testid={SETTINGS_HUB_TEST_IDS.locationsPage}>
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <LocationsSettingsClientReady
      session={session}
      destinationLocationTypes={destinationLocationTypes}
    />
  );
}

function LocationsSettingsClientReady({
  session,
  destinationLocationTypes,
}: LocationsSettingsClientProps & {
  readonly destinationLocationTypes: ReturnType<typeof destinationLocationTypesForPlugin>;
}) {
  const pluginId = session.pluginId;
  const t = useTranslations("settings.locations");
  const tErrors = useTranslations("settings.errors");
  const tCommon = useTranslations("common");
  const tSettings = useTranslations("settings");
  const canManage = isAdminOrOwnerRole(session.role);
  const [regions, setRegions] = useState<readonly RegionResource[]>([]);
  const [destinations, setDestinations] = useState<readonly DestinationResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [regionName, setRegionName] = useState("");
  const [regionCountry, setRegionCountry] = useState("");
  const [destinationForm, setDestinationForm] = useState<DestinationFormDraft>(
    EMPTY_DESTINATION_FORM_DRAFT
  );
  const [editingDestinationId, setEditingDestinationId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [fetchNonce, setFetchNonce] = useState(0);
  const [activeTab, setActiveTab] = useState<"regions" | "destinations">("regions");

  useEffect(() => {
    let cancelled = false;
    const isInitialLoad = fetchNonce === 0;
    if (isInitialLoad) {
      setLoading(true);
    }
    setError(null);
    void fetch("/api/settings/resources/locations", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`LOCATIONS_HTTP_${response.status}`);
        }
        return parseLocationsResponse(await response.json());
      })
      .then((payload) => {
        if (!cancelled) {
          setRegions(payload.regions);
          setDestinations(payload.destinations);
          setDestinationForm((current) => ({
            ...current,
            regionId:
              current.regionId.length > 0 ? current.regionId : (payload.regions[0]?.id ?? ""),
          }));
        }
      })
      .catch((fetchError: unknown) => {
        if (!cancelled) {
          setError(fetchError instanceof Error ? fetchError.message : "LOCATIONS_FETCH_FAILED");
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

  const resetDestinationForm = (regionId?: string) => {
    setEditingDestinationId(null);
    setDestinationForm({
      ...EMPTY_DESTINATION_FORM_DRAFT,
      regionId: regionId ?? destinationForm.regionId,
    });
  };

  const handleCreateRegion = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canManage || regionName.trim().length === 0) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/settings/resources/locations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entity: "region",
          name: regionName.trim(),
          ...(regionCountry.trim().length > 0 ? { country: regionCountry.trim() } : {}),
        }),
      });
      if (!response.ok) {
        throw new Error(`REGION_CREATE_HTTP_${response.status}`);
      }
      setRegionName("");
      setRegionCountry("");
      refresh();
    } catch (createError: unknown) {
      setError(createError instanceof Error ? createError.message : "REGION_CREATE_FAILED");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveDestination = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canManage) {
      return;
    }
    const isEditing = editingDestinationId !== null;
    const body = isEditing
      ? buildDestinationPatchBody(destinationForm, pluginId)
      : buildDestinationCreateBody(destinationForm, pluginId);
    if (body === null) {
      setError("DESTINATION_INVALID_METADATA");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(
        isEditing
          ? `/api/settings/resources/locations/${editingDestinationId}`
          : "/api/settings/resources/locations",
        {
          method: isEditing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );
      if (!response.ok) {
        throw new Error(
          isEditing ? `DESTINATION_PATCH_HTTP_${response.status}` : `DESTINATION_CREATE_HTTP_${response.status}`
        );
      }
      resetDestinationForm(destinationForm.regionId);
      refresh();
    } catch (saveError: unknown) {
      setError(saveError instanceof Error ? saveError.message : "DESTINATION_SAVE_FAILED");
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
      const response = await fetch(`/api/settings/resources/locations/${itemId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error(`LOCATION_DELETE_HTTP_${response.status}`);
      }
      if (editingDestinationId === itemId) {
        resetDestinationForm();
      }
      refresh();
    } catch (deleteError: unknown) {
      setError(deleteError instanceof Error ? deleteError.message : "LOCATION_DELETE_FAILED");
    } finally {
      setSaving(false);
    }
  };

  const startEditingDestination = (destination: DestinationResource) => {
    setEditingDestinationId(destination.id);
    setDestinationForm(destinationFormDraftFromResource(destination, pluginId));
  };

  const resolveLocationTypeLabel = (locationType: string | null) => {
    const entry = destinationLocationTypes.find((row) => row.value === locationType);
    return entry ? t(entry.settingsLabelKey) : t("locationTypeGeneric");
  };

  return (
    <div className="space-y-6" data-testid={SETTINGS_HUB_TEST_IDS.locationsPage}>
      <SettingsPageHeader title={t("title")} description={t("subtitle")} />

      {loading ? <Skeleton className="h-32 w-full" /> : null}
      {error !== null ? (
        <p className="text-sm text-destructive">
          {error === "DESTINATION_INVALID_METADATA"
            ? t("invalidMetadata")
            : resolveCodedErrorMessage(tErrors, error)}
        </p>
      ) : null}

      <div className="flex gap-2">
        <Button
          type="button"
          variant={activeTab === "regions" ? "default" : "outline"}
          onClick={() => setActiveTab("regions")}
        >
          {t("tabs.regions")}
        </Button>
        <Button
          type="button"
          variant={activeTab === "destinations" ? "default" : "outline"}
          onClick={() => setActiveTab("destinations")}
        >
          {t("tabs.destinations")}
        </Button>
      </div>

      {activeTab === "regions" ? (
        <div className="space-y-4">
          {canManage ? (
            <Card data-operator-surface="card" className="shadow-sm">
              <CardHeader>
                <CardTitle>{t("addRegion")}</CardTitle>
              </CardHeader>
              <CardContent>
                <form
                  className="grid gap-4 sm:grid-cols-3"
                  onSubmit={(event) => void handleCreateRegion(event)}
                >
                  <div className="space-y-2">
                    <Label htmlFor="region-name">{tCommon("name")}</Label>
                    <Input
                      id="region-name"
                      value={regionName}
                      onChange={(event) => setRegionName(event.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="region-country">{t("country")}</Label>
                    <Input
                      id="region-country"
                      value={regionCountry}
                      onChange={(event) => setRegionCountry(event.target.value)}
                    />
                  </div>
                  <div className="flex items-end">
                    <Button type="submit" disabled={saving}>
                      <Plus className="me-1 size-4" />
                      {t("addRegion")}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          ) : null}

          <Card data-operator-surface="card" className="shadow-sm" data-testid={SETTINGS_HUB_TEST_IDS.locationsRegions}>
            <CardHeader>
              <CardTitle>{t("regionsCount", { count: regions.length })}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {regions.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("noRegions")}</p>
              ) : (
                regions.map((region) => (
                  <div
                    key={region.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div>
                      <p className="font-medium">{region.name}</p>
                      {region.country ? (
                        <p className="text-xs text-muted-foreground">{region.country}</p>
                      ) : null}
                    </div>
                    {canManage ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={saving}
                        aria-label={tSettings("deleteItem", { name: region.name })}
                        onClick={() => void handleDelete(region.id)}
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
      ) : (
        <div className="space-y-4">
          {canManage ? (
            <Card data-operator-surface="card" className="shadow-sm">
              <CardHeader>
                <CardTitle>
                  {editingDestinationId === null ? t("addDestination") : t("saveDestination")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form className="grid gap-4 sm:grid-cols-2" onSubmit={(event) => void handleSaveDestination(event)}>
                  <div className="space-y-2">
                    <Label htmlFor="destination-region">{t("region")}</Label>
                    <select
                      id="destination-region"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={destinationForm.regionId}
                      onChange={(event) =>
                        setDestinationForm((current) => ({ ...current, regionId: event.target.value }))
                      }
                      required
                    >
                      <option value="">{t("selectRegion")}</option>
                      {regions.map((region) => (
                        <option key={region.id} value={region.id}>
                          {region.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="destination-name">{tCommon("name")}</Label>
                    <Input
                      id="destination-name"
                      value={destinationForm.name}
                      onChange={(event) =>
                        setDestinationForm((current) => ({ ...current, name: event.target.value }))
                      }
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="destination-type">{t("locationType")}</Label>
                    <select
                      id="destination-type"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={destinationForm.locationType}
                      onChange={(event) =>
                        setDestinationForm((current) => ({
                          ...current,
                          locationType: event.target.value as DestinationLocationType,
                          altitudeM: "",
                          typicalTrailDistanceKm: "",
                        }))
                      }
                    >
                      {destinationLocationTypes.map((entry) => (
                        <option key={entry.value} value={entry.value}>
                          {t(entry.settingsLabelKey)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <DestinationMetadataFields
                    draft={destinationForm}
                    onChange={setDestinationForm}
                    t={t}
                    pluginId={pluginId}
                  />
                  <div className="flex flex-wrap items-end gap-2 sm:col-span-2">
                    <Button type="submit" disabled={saving || regions.length === 0}>
                      <Plus className="me-1 size-4" />
                      {editingDestinationId === null ? t("addDestination") : t("saveDestination")}
                    </Button>
                    {editingDestinationId !== null ? (
                      <Button
                        type="button"
                        variant="outline"
                        disabled={saving}
                        onClick={() => resetDestinationForm(destinationForm.regionId)}
                      >
                        {t("cancelEdit")}
                      </Button>
                    ) : null}
                  </div>
                </form>
              </CardContent>
            </Card>
          ) : null}

          <Card data-operator-surface="card" className="shadow-sm" data-testid={SETTINGS_HUB_TEST_IDS.locationsDestinations}>
            <CardHeader>
              <CardTitle>{t("destinationsCount", { count: destinations.length })}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {destinations.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("noDestinations")}</p>
              ) : (
                destinations.map((destination) => {
                  const metadataSummary = formatDestinationMetadataSummary(destination, pluginId);
                  return (
                    <div
                      key={destination.id}
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <div>
                        <p className="font-medium">{destination.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {t("regionLabel", {
                            name:
                              regions.find((region) => region.id === destination.regionId)?.name ??
                              destination.regionId,
                          })}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {resolveLocationTypeLabel(destination.locationType)}
                          {metadataSummary !== null
                            ? ` · ${t("metadataLabel", { value: metadataSummary })}`
                            : ""}
                        </p>
                      </div>
                      {canManage ? (
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={saving}
                            aria-label={t("editDestination", { name: destination.name })}
                            onClick={() => startEditingDestination(destination)}
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={saving}
                            aria-label={tSettings("deleteItem", { name: destination.name })}
                            onClick={() => void handleDelete(destination.id)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
