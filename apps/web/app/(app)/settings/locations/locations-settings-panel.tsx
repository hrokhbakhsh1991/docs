"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useSettingsDestinations } from "@/hooks/use-settings-destinations";
import { useSettingsRegions } from "@/hooks/use-settings-regions";
import type { SettingsDestinationDto, SettingsRegionDto } from "@/lib/settings-locations-client";
import { normalizeSortOrder, pickSortOrderDeltas } from "@/lib/sort-order";
import { isLeaderRole, useAuth } from "@/lib/auth/auth-context";

import {
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  FormField,
  LoadingState,
  Modal,
  Select,
  cn,
  useToast,
} from "@tour/ui";

import formStyles from "../settings-profile-form.module.css";
import { DestinationForm, type DestinationFormParsed } from "./destination-form";
import { DestinationSortableBlock } from "./destinations-list";
import { RegionForm, type RegionFormParsed } from "./region-form";
import { RegionList } from "./region-list";
import panelStyles from "./locations-settings-panel.module.css";

export type SettingsRegion = SettingsRegionDto;
export type SettingsDestination = SettingsDestinationDto;

export function LocationsSettingsPanel() {
  const t = useTranslations("settings");
  const { showToast } = useToast();
  const { user } = useAuth();
  const canManageWorkspace = isLeaderRole(user?.role);
  const readOnlyList = !canManageWorkspace;

  const {
    regions,
    isLoading: regionsLoading,
    error: regionsError,
    refetch: refetchRegions,
    createRegion,
    updateRegion,
    deleteRegion,
    reorderRegions,
    isMutating: regionsMutating,
  } = useSettingsRegions();

  const {
    destinations,
    isLoading: destinationsLoading,
    error: destinationsError,
    refetch: refetchDestinations,
    createDestination,
    updateDestination,
    deleteDestination,
    reorderDestinations,
    isMutating: destinationsMutating,
  } = useSettingsDestinations();

  const sortedRegions = useMemo(
    () =>
      [...regions].sort(
        (a, b) =>
          (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
      ),
    [regions],
  );

  const [regionFilterId, setRegionFilterId] = useState<string | null>(null);
  const [regionFormOpen, setRegionFormOpen] = useState(false);
  const [editingRegion, setEditingRegion] = useState<SettingsRegionDto | null>(null);
  const [deleteRegionTarget, setDeleteRegionTarget] = useState<SettingsRegionDto | null>(null);

  const [destinationFormOpen, setDestinationFormOpen] = useState(false);
  const [editingDestination, setEditingDestination] = useState<SettingsDestinationDto | null>(null);
  const [defaultRegionIdForNewDestination, setDefaultRegionIdForNewDestination] = useState("");
  const [deleteDestinationTarget, setDeleteDestinationTarget] = useState<SettingsDestinationDto | null>(null);

  useEffect(() => {
    if (regionFilterId && !regions.some((r) => r.id === regionFilterId)) {
      setRegionFilterId(null);
    }
  }, [regions, regionFilterId]);

  const regionNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of regions) {
      m.set(r.id, r.name);
    }
    return m;
  }, [regions]);

  const regionsMut = regionsMutating;
  const destMut = destinationsMutating;
  const anyMutating = regionsMut || destMut;

  const openCreateRegion = useCallback(() => {
    setEditingRegion(null);
    setRegionFormOpen(true);
  }, []);

  const openEditRegion = useCallback((r: SettingsRegionDto) => {
    setEditingRegion(r);
    setRegionFormOpen(true);
  }, []);

  const closeRegionForm = useCallback(() => {
    setRegionFormOpen(false);
    setEditingRegion(null);
  }, []);

  const onSubmitRegionForm = useCallback(
    async (values: RegionFormParsed) => {
      try {
        const payload = {
          name: values.name,
          country: values.country,
          sortOrder: values.sortOrder ?? null,
          isActive: values.isActive,
        };
        if (editingRegion) {
          await updateRegion(editingRegion.id, payload);
        } else {
          await createRegion(payload);
        }
        showToast({ type: "success", message: t("locationsToastRegionSaved") });
        closeRegionForm();
      } catch (e) {
        showToast({
          type: "error",
          message: e instanceof Error ? e.message : t("locationsToastRegionSaveFailed"),
        });
      }
    },
    [closeRegionForm, createRegion, editingRegion, showToast, t, updateRegion],
  );

  const onToggleRegionActive = useCallback(
    async (item: SettingsRegionDto, next: boolean) => {
      if (item.isActive === next) {
        return;
      }
      try {
        await updateRegion(item.id, { isActive: next });
        showToast({ type: "success", message: t("locationsToastRegionSaved") });
      } catch (e) {
        showToast({
          type: "error",
          message: e instanceof Error ? e.message : t("locationsToastRegionSaveFailed"),
        });
      }
    },
    [showToast, t, updateRegion],
  );

  const onReorderRegions = useCallback(
    async (itemIds: string[]) => {
      const byId = new Map(sortedRegions.map((r) => [r.id, r]));
      const reordered = itemIds.map((id) => byId.get(id)).filter((r): r is SettingsRegionDto => r != null);
      const nextOrdered = reordered.map((r, index) => ({ ...r, sortOrder: index }));
      const patches = pickSortOrderDeltas(sortedRegions, normalizeSortOrder(nextOrdered));
      try {
        await reorderRegions(nextOrdered, patches);
        if (patches.length > 0) {
          showToast({ type: "success", message: t("locationsToastOrderUpdated") });
        }
      } catch (e) {
        showToast({
          type: "error",
          message: e instanceof Error ? e.message : t("locationsToastOrderUpdateFailed"),
        });
      }
    },
    [reorderRegions, showToast, sortedRegions, t],
  );

  const openCreateDestination = useCallback(() => {
    setEditingDestination(null);
    setDefaultRegionIdForNewDestination(regionFilterId ?? "");
    setDestinationFormOpen(true);
  }, [regionFilterId]);

  const openEditDestination = useCallback((d: SettingsDestinationDto) => {
    setEditingDestination(d);
    setDestinationFormOpen(true);
  }, []);

  const closeDestinationForm = useCallback(() => {
    setDestinationFormOpen(false);
    setEditingDestination(null);
  }, []);

  const onSubmitDestinationForm = useCallback(
    async (values: DestinationFormParsed) => {
      try {
        const payload = {
          name: values.name,
          regionId: values.regionId,
          type: values.type,
          altitudeM: values.altitudeM,
          sortOrder: values.sortOrder ?? null,
          isActive: values.isActive,
        };
        if (editingDestination) {
          await updateDestination(editingDestination.id, payload);
        } else {
          await createDestination(payload);
        }
        showToast({ type: "success", message: t("locationsToastDestinationSaved") });
        closeDestinationForm();
      } catch (e) {
        showToast({
          type: "error",
          message: e instanceof Error ? e.message : t("locationsToastDestinationSaveFailed"),
        });
      }
    },
    [closeDestinationForm, createDestination, editingDestination, showToast, t, updateDestination],
  );

  const onToggleDestinationActive = useCallback(
    async (item: SettingsDestinationDto, next: boolean) => {
      if (item.isActive === next) {
        return;
      }
      try {
        await updateDestination(item.id, { isActive: next });
        showToast({ type: "success", message: t("locationsToastDestinationSaved") });
      } catch (e) {
        showToast({
          type: "error",
          message: e instanceof Error ? e.message : t("locationsToastDestinationSaveFailed"),
        });
      }
    },
    [showToast, t, updateDestination],
  );

  const confirmDeleteRegion = useCallback(async () => {
    if (!deleteRegionTarget) {
      return;
    }
    try {
      if (editingRegion?.id === deleteRegionTarget.id) {
        closeRegionForm();
      }
      await deleteRegion(deleteRegionTarget.id);
      showToast({ type: "success", message: t("locationsToastRegionDeleted") });
      setDeleteRegionTarget(null);
    } catch (e) {
      showToast({
        type: "error",
        message: e instanceof Error ? e.message : t("locationsToastDeleteFailed"),
      });
    }
  }, [closeRegionForm, deleteRegion, deleteRegionTarget, editingRegion?.id, showToast, t]);

  const confirmDeleteDestination = useCallback(async () => {
    if (!deleteDestinationTarget) {
      return;
    }
    try {
      if (editingDestination?.id === deleteDestinationTarget.id) {
        closeDestinationForm();
      }
      await deleteDestination(deleteDestinationTarget.id);
      showToast({ type: "success", message: t("locationsToastDestinationDeleted") });
      setDeleteDestinationTarget(null);
    } catch (e) {
      showToast({
        type: "error",
        message: e instanceof Error ? e.message : t("locationsToastDeleteFailed"),
      });
    }
  }, [closeDestinationForm, deleteDestination, deleteDestinationTarget, editingDestination?.id, showToast, t]);

  const loadError = regionsError ?? destinationsError;
  const loadErrorMessage = loadError instanceof Error ? loadError.message : String(loadError ?? "");
  const tBlock = t as (key: string, values?: Record<string, string>) => string;

  if (loadError && regions.length === 0 && destinations.length === 0 && !regionsLoading && !destinationsLoading) {
    return (
      <div className={cn(formStyles.form, panelStyles.panel)}>
        <ErrorState
          title={t("locationsLoadErrorTitle")}
          message={loadErrorMessage}
          onRetry={() => {
            void refetchRegions();
            void refetchDestinations();
          }}
        />
      </div>
    );
  }

  return (
    <div className={cn(formStyles.form, panelStyles.panel)}>
      <p className={panelStyles.catalogIntro}>{t("locationsPanelIntro")}</p>
      <div className={panelStyles.cardStack}>
        <Card>
          <CardHeader>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "var(--space-3)",
              }}
            >
              <CardTitle>{t("locationsCardRegionsTitle")}</CardTitle>
              {canManageWorkspace ? (
                <Button type="button" variant="primary" size="sm" onClick={openCreateRegion} disabled={anyMutating}>
                  {t("locationsRegionAdd")}
                </Button>
              ) : null}
            </div>
          </CardHeader>
          <CardBody>
            {readOnlyList && regions.length > 0 ? (
              <p className={formStyles.readOnlyBanner}>{t("locationsReadOnlyBanner")}</p>
            ) : null}
            {regionsLoading ? <LoadingState message={t("locationsLoadingRegions")} /> : null}

            {!regionsLoading && regionsError && regions.length === 0 ? (
              <ErrorState
                title={t("locationsLoadErrorTitle")}
                message={regionsError instanceof Error ? regionsError.message : t("locationsLoadErrorTitle")}
                onRetry={() => void refetchRegions()}
              />
            ) : null}

            {!regionsLoading && regions.length === 0 ? (
              <EmptyState
                embedded
                className={panelStyles.emptyState}
                title={t("locationsEmptyRegionsTitle")}
                description={readOnlyList ? t("locationsReadOnlyHint") : t("locationsEmptyRegionsDescription")}
              />
            ) : null}

            {regions.length > 0 ? (
              <RegionList
                items={regions}
                onEdit={openEditRegion}
                onDelete={readOnlyList ? () => {} : (r) => setDeleteRegionTarget(r)}
                onToggleActive={onToggleRegionActive}
                onReorder={onReorderRegions}
                mutating={regionsMutating}
                readOnly={readOnlyList}
              />
            ) : null}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "var(--space-3)",
              }}
            >
              <CardTitle>{t("locationsCardDestinationsTitle")}</CardTitle>
              {canManageWorkspace ? (
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={openCreateDestination}
                  disabled={anyMutating || regions.length === 0}
                >
                  {t("locationsDestinationAdd")}
                </Button>
              ) : null}
            </div>
          </CardHeader>
          <CardBody>
            {readOnlyList && destinations.length > 0 ? (
              <p className={formStyles.readOnlyBanner}>{t("locationsReadOnlyBanner")}</p>
            ) : null}
            {destinationsLoading ? <LoadingState message={t("locationsLoadingDestinations")} /> : null}

            {!destinationsLoading && destinationsError && destinations.length === 0 ? (
              <ErrorState
                title={t("locationsLoadErrorTitle")}
                message={
                  destinationsError instanceof Error ? destinationsError.message : t("locationsLoadErrorTitle")
                }
                onRetry={() => void refetchDestinations()}
              />
            ) : null}

            <div className={panelStyles.filterRow}>
              <FormField label={t("locationsFilterDestinationsLabel")}>
                <Select
                  value={regionFilterId ?? ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    setRegionFilterId(v === "" ? null : v);
                  }}
                  disabled={regions.length === 0}
                >
                  <option value="">{t("locationsFilterAll")}</option>
                  {regions.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </Select>
              </FormField>
            </div>

            {!destinationsLoading && destinations.length === 0 ? (
              <EmptyState
                embedded
                className={panelStyles.emptyState}
                title={t("locationsEmptyDestinationsTitle")}
                description={
                  regions.length === 0
                    ? t("locationsEmptyDestinationsNoRegions")
                    : readOnlyList
                      ? t("locationsReadOnlyHint")
                      : t("locationsEmptyDestinationsDescription")
                }
              />
            ) : null}

            {destinations.length > 0 ? (
              regionFilterId ? (
                <DestinationSortableBlock
                  regionId={regionFilterId}
                  regionTitle={t("locationsRegionSubheading", {
                    name: regionNameById.get(regionFilterId) ?? regionFilterId,
                  })}
                  hideWhenEmpty={false}
                  allDestinations={destinations}
                  regionNameById={regionNameById}
                  reorderDestinations={reorderDestinations}
                  showToast={showToast}
                  t={tBlock}
                  onEditDestination={openEditDestination}
                  onRequestDeleteDestination={
                    readOnlyList ? () => {} : (d) => setDeleteDestinationTarget(d)
                  }
                  onToggleDestinationActive={onToggleDestinationActive}
                  destinationsMutating={destinationsMutating}
                  readOnly={readOnlyList}
                />
              ) : (
                regions.map((r) => (
                  <DestinationSortableBlock
                    key={r.id}
                    regionId={r.id}
                    regionTitle={t("locationsRegionSubheading", { name: r.name })}
                    hideWhenEmpty
                    allDestinations={destinations}
                    regionNameById={regionNameById}
                    reorderDestinations={reorderDestinations}
                    showToast={showToast}
                    t={tBlock}
                    onEditDestination={openEditDestination}
                    onRequestDeleteDestination={
                      readOnlyList ? () => {} : (d) => setDeleteDestinationTarget(d)
                    }
                    onToggleDestinationActive={onToggleDestinationActive}
                    destinationsMutating={destinationsMutating}
                    readOnly={readOnlyList}
                  />
                ))
              )
            ) : null}
          </CardBody>
        </Card>
      </div>

      <Modal
        open={regionFormOpen}
        onClose={closeRegionForm}
        title={editingRegion ? t("locationsRegionEditTitle") : t("locationsRegionAddTitle")}
        footer={null}
      >
        <RegionForm
          editing={editingRegion}
          onSubmit={onSubmitRegionForm}
          onCancel={closeRegionForm}
          isPending={regionsMutating}
        />
      </Modal>

      <Modal
        open={destinationFormOpen}
        onClose={closeDestinationForm}
        title={editingDestination ? t("locationsDestinationEditTitle") : t("locationsDestinationAddTitle")}
        footer={null}
      >
        <DestinationForm
          editing={editingDestination}
          defaultRegionIdWhenCreating={defaultRegionIdForNewDestination}
          allRegions={regions}
          onSubmit={onSubmitDestinationForm}
          onCancel={closeDestinationForm}
          isPending={destinationsMutating}
        />
      </Modal>

      <ConfirmDialog
        open={deleteRegionTarget != null}
        title={t("locationsDeleteRegionConfirmTitle")}
        description={
          deleteRegionTarget
            ? t("locationsDeleteRegionConfirmDescription", { name: deleteRegionTarget.name })
            : undefined
        }
        confirmLabel={t("locationsDeleteConfirmAction")}
        cancelLabel={t("locationsModalCancel")}
        variant="danger"
        onConfirm={() => void confirmDeleteRegion()}
        onCancel={() => setDeleteRegionTarget(null)}
      />

      <ConfirmDialog
        open={deleteDestinationTarget != null}
        title={t("locationsDeleteDestinationConfirmTitle")}
        description={
          deleteDestinationTarget
            ? t("locationsDeleteDestinationConfirmDescription", { name: deleteDestinationTarget.name })
            : undefined
        }
        confirmLabel={t("locationsDeleteConfirmAction")}
        cancelLabel={t("locationsModalCancel")}
        variant="danger"
        onConfirm={() => void confirmDeleteDestination()}
        onCancel={() => setDeleteDestinationTarget(null)}
      />
    </div>
  );
}
