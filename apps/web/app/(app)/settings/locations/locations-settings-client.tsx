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

export function LocationsSettingsClient({ session }: LocationsSettingsClientProps) {
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
  const [destinationName, setDestinationName] = useState("");
  const [destinationRegionId, setDestinationRegionId] = useState("");
  const [saving, setSaving] = useState(false);
  const [fetchNonce, setFetchNonce] = useState(0);
  const [activeTab, setActiveTab] = useState<"regions" | "destinations">("regions");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
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
          setDestinationRegionId((current) =>
            current.length > 0 ? current : (payload.regions[0]?.id ?? "")
          );
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

  const handleCreateDestination = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canManage || destinationName.trim().length === 0 || destinationRegionId.length === 0) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/settings/resources/locations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entity: "destination",
          regionId: destinationRegionId,
          name: destinationName.trim(),
        }),
      });
      if (!response.ok) {
        throw new Error(`DESTINATION_CREATE_HTTP_${response.status}`);
      }
      setDestinationName("");
      refresh();
    } catch (createError: unknown) {
      setError(createError instanceof Error ? createError.message : "DESTINATION_CREATE_FAILED");
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
      refresh();
    } catch (deleteError: unknown) {
      setError(deleteError instanceof Error ? deleteError.message : "LOCATION_DELETE_FAILED");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6" data-testid={SETTINGS_HUB_TEST_IDS.locationsPage}>
      <SettingsPageHeader title={t("title")} description={t("subtitle")} />

      {loading ? <Skeleton className="h-32 w-full" /> : null}
      {error !== null ? (
        <p className="text-sm text-destructive">{resolveCodedErrorMessage(tErrors, error)}</p>
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
            <Card data-denali-surface="card" className="shadow-sm">
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

          <Card data-denali-surface="card" className="shadow-sm" data-testid={SETTINGS_HUB_TEST_IDS.locationsRegions}>
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
            <Card data-denali-surface="card" className="shadow-sm">
              <CardHeader>
                <CardTitle>{t("addDestination")}</CardTitle>
              </CardHeader>
              <CardContent>
                <form
                  className="grid gap-4 sm:grid-cols-3"
                  onSubmit={(event) => void handleCreateDestination(event)}
                >
                  <div className="space-y-2">
                    <Label htmlFor="destination-region">{t("region")}</Label>
                    <select
                      id="destination-region"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={destinationRegionId}
                      onChange={(event) => setDestinationRegionId(event.target.value)}
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
                      value={destinationName}
                      onChange={(event) => setDestinationName(event.target.value)}
                      required
                    />
                  </div>
                  <div className="flex items-end">
                    <Button type="submit" disabled={saving || regions.length === 0}>
                      <Plus className="me-1 size-4" />
                      {t("addDestination")}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          ) : null}

          <Card data-denali-surface="card" className="shadow-sm" data-testid={SETTINGS_HUB_TEST_IDS.locationsDestinations}>
            <CardHeader>
              <CardTitle>{t("destinationsCount", { count: destinations.length })}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {destinations.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("noDestinations")}</p>
              ) : (
                destinations.map((destination) => (
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
                    </div>
                    {canManage ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={saving}
                        aria-label={tSettings("deleteItem", { name: destination.name })}
                        onClick={() => void handleDelete(destination.id)}
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
      )}
    </div>
  );
}