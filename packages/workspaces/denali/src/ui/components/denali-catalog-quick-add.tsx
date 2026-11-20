"use client";

import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";

import { DENALI_DESTINATION_LOCATION_TYPES } from "../../settings/destination-location-types";
import { DENALI_SUBMIT_CATALOG_BFF_PATHS } from "../../wizard/denali-wizard-catalog-sanitize";
import type {
  DestinationResource,
  EquipmentResource,
  LocationsListResponse,
} from "../adapters/catalog-types";
import { parseLocationsResponse } from "../adapters/catalog-parse";
import {
  canApplyQuickAddResult,
  parseCreatedCatalogResource,
  parseQuickAddMetric,
} from "../logic/quick-add";

type Props = {
  readonly disabled?: boolean;
  readonly getDraftRevision: () => unknown;
  readonly onUncertain: () => void;
} & (
  | {
      readonly kind: "destination";
      readonly offerType: (type: string) => boolean;
      readonly onCreated: (row: DestinationResource) => boolean;
    }
  | {
      readonly kind: "equipment";
      readonly onCreated: (row: EquipmentResource, required: boolean) => boolean;
    }
);

export function DenaliCatalogQuickAdd(props: Props) {
  const t = useTranslations("denali.quickAdd");
  const dialog = useRef<HTMLDialogElement>(null);
  const title = useId();
  const description = useId();
  const mounted = useRef(false);
  const inFlight = useRef(false);
  const [portalReady, setPortalReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [locations, setLocations] = useState<LocationsListResponse | null>(null);
  const [equipmentNames, setEquipmentNames] = useState<readonly string[] | null>(null);
  const [metric, setMetric] = useState("");
  const [loadError, setLoadError] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [name, setName] = useState("");
  const [regionId, setRegionId] = useState("");
  const [locationType, setLocationType] = useState("generic");
  const [required, setRequired] = useState(true);
  const [error, setError] = useState<"duplicate" | "saveFailed" | "uncertain" | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    mounted.current = true;
    setPortalReady(true);
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const kind = props.kind;
    const controller = new AbortController();
    void fetch(
      kind === "destination"
        ? DENALI_SUBMIT_CATALOG_BFF_PATHS.locations
        : DENALI_SUBMIT_CATALOG_BFF_PATHS.equipment,
      {
        cache: "no-store",
        signal: controller.signal,
      }
    )
      .then(async (response) => {
        if (!response.ok) throw new Error("CATALOG_LOAD_FAILED");
        const payload: unknown = await response.json();
        if (controller.signal.aborted) return;
        if (typeof payload !== "object" || payload === null) throw new Error("CATALOG_LOAD_FAILED");
        if (kind === "equipment") {
          const items = (payload as Record<string, unknown>).items;
          if (
            !Array.isArray(items) ||
            !items.every((item) => item && typeof item.name === "string")
          ) {
            throw new Error("CATALOG_LOAD_FAILED");
          }
          setEquipmentNames(items.map((item) => item.name));
        } else {
          const locationPayload = payload as LocationsListResponse;
          if (
            !Array.isArray(locationPayload.regions) ||
            !Array.isArray(locationPayload.destinations)
          ) {
            throw new Error("CATALOG_LOAD_FAILED");
          }
          setLocations(parseLocationsResponse(payload));
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setLoadError(true);
      });
    return () => controller.abort();
  }, [open, props.kind, loadAttempt]);

  const offeredTypes =
    props.kind === "destination"
      ? DENALI_DESTINATION_LOCATION_TYPES.filter((item) => props.offerType(item.value))
      : [];
  const selectedType = offeredTypes.find((item) => item.value === locationType);
  const typeAllowed = selectedType !== undefined;
  const metricKey = selectedType?.metadataFields[0];
  const metricValue = metricKey
    ? parseQuickAddMetric(metric, metricKey === "typicalTrailDistanceKm")
    : undefined;
  const catalogReady = props.kind === "destination" ? locations !== null : equipmentNames !== null;
  const label = t(props.kind === "destination" ? "addDestination" : "addEquipment");

  function openDialog() {
    setName("");
    setRegionId("");
    setLocationType(offeredTypes[0]?.value ?? "");
    setRequired(true);
    setMetric("");
    setEquipmentNames(null);
    setLocations(null);
    setLoadError(false);
    setError(null);
    setNotice(false);
    dialog.current?.showModal();
    setOpen(true);
  }

  function setUncertain() {
    setError("uncertain");
    props.onUncertain();
  }

  function clearDuplicate() {
    if (error === "duplicate") setError(null);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (inFlight.current || error === "uncertain" || !catalogReady || metricValue === null) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    if (
      props.kind === "destination" &&
      (!locations?.regions.some((region) => region.id === regionId && region.isActive) ||
        !props.offerType(locationType))
    )
      return;
    const existingNames =
      props.kind === "equipment"
        ? (equipmentNames ?? [])
        : (locations?.destinations ?? [])
            .filter((row) => row.regionId === regionId)
            .map((row) => row.name);
    const comparable = (value: string) => value.normalize("NFKC").trim().toLowerCase();
    if (existingNames.some((existing) => comparable(existing) === comparable(trimmed))) {
      setError("duplicate");
      return;
    }

    const revisionAtSubmit = props.getDraftRevision();
    inFlight.current = true;
    setSaving(true);
    setError(null);
    try {
      const isDestination = props.kind === "destination";
      const response = await fetch(
        isDestination
          ? DENALI_SUBMIT_CATALOG_BFF_PATHS.locations
          : DENALI_SUBMIT_CATALOG_BFF_PATHS.equipment,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            isDestination
              ? {
                  entity: "destination",
                  regionId,
                  name: trimmed,
                  locationType,
                  ...(metricKey && metricValue !== undefined ? { [metricKey]: metricValue } : {}),
                }
              : { name: trimmed }
          ),
          signal: AbortSignal.timeout(15000),
        }
      );
      if (!response.ok) {
        if (mounted.current) {
          if (response.status >= 500) setUncertain();
          else setError("saveFailed");
        }
        return;
      }
      const row: unknown = await response.json();
      if (!mounted.current) return;
      const sameDraft = canApplyQuickAddResult(
        mounted.current,
        revisionAtSubmit,
        props.getDraftRevision()
      );
      let selected: boolean;
      if (props.kind === "destination") {
        const destination = parseCreatedCatalogResource("destination", row, regionId);
        if (!destination) {
          setUncertain();
          return;
        }
        selected = sameDraft && props.onCreated(destination);
      } else {
        const equipment = parseCreatedCatalogResource("equipment", row);
        if (!equipment) {
          setUncertain();
          return;
        }
        selected = sameDraft && props.onCreated(equipment, required);
      }
      if (!sameDraft) props.onUncertain();
      setNotice(!selected);
      dialog.current?.close();
    } catch {
      if (mounted.current) setUncertain();
    } finally {
      inFlight.current = false;
      if (mounted.current) setSaving(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className="denali-wizard-composite__link"
        ref={trigger}
        aria-label={label}
        disabled={!portalReady || props.disabled}
        onClick={openDialog}
      >
        + <span>{label}</span>
      </button>
      {notice ? <p role="status">{t("savedNotSelected")}</p> : null}
      {portalReady
        ? createPortal(
            <dialog
              ref={dialog}
              aria-labelledby={title}
              aria-describedby={description}
              className="m-auto w-[calc(100%_-_2rem)] max-w-md rounded-lg border border-border bg-background p-4 text-foreground backdrop:bg-black/50"
              onCancel={(event) => {
                if (inFlight.current) event.preventDefault();
              }}
              onClose={() => {
                setOpen(false);
                trigger.current?.focus();
              }}
            >
              <form className="space-y-3" onSubmit={(event) => void save(event)}>
                <h3 id={title}>{label}</h3>
                <p id={description} className="text-sm text-muted-foreground">
                  {t("sharedCatalog")}
                </p>
                <label className="block">
                  {t("name")}
                  <input
                    className="block w-full rounded border border-border bg-background p-2"
                    value={name}
                    maxLength={160}
                    onChange={(event) => {
                      setName(event.target.value);
                      clearDuplicate();
                    }}
                    required
                    autoFocus
                    disabled={saving}
                  />
                </label>
                {props.kind === "equipment" && !catalogReady && !loadError ? (
                  <p role="status">{t("loading")}</p>
                ) : null}
                {loadError ? (
                  <p role="alert">
                    {t("loadFailed")}{" "}
                    <button
                      type="button"
                      onClick={() => {
                        setLoadError(false);
                        setLoadAttempt((v) => v + 1);
                      }}
                    >
                      {t("retry")}
                    </button>
                  </p>
                ) : null}
                {props.kind === "destination" ? (
                  <>
                    <label className="block">
                      {t("region")}
                      <select
                        className="block w-full rounded border border-border bg-background p-2"
                        value={regionId}
                        onChange={(event) => {
                          setRegionId(event.target.value);
                          clearDuplicate();
                        }}
                        required
                        disabled={!locations || saving}
                      >
                        <option value="">{t(locations ? "selectRegion" : "loading")}</option>
                        {locations?.regions
                          .filter((region) => region.isActive)
                          .map((region) => (
                            <option key={region.id} value={region.id}>
                              {region.name}
                            </option>
                          ))}
                      </select>
                    </label>
                    <label className="block">
                      {t("type")}
                      <select
                        className="block w-full rounded border border-border bg-background p-2"
                        value={typeAllowed ? locationType : ""}
                        onChange={(event) => {
                          setLocationType(event.target.value);
                          setMetric("");
                        }}
                        disabled={saving}
                      >
                        {!typeAllowed ? <option value="">{t("type")}</option> : null}
                        {offeredTypes.map((item) => (
                          <option key={item.value} value={item.value}>
                            {t(item.value)}
                          </option>
                        ))}
                      </select>
                    </label>
                    {metricKey ? (
                      <label className="block">
                        {t(metricKey)}
                        <input
                          className="block w-full rounded border border-border bg-background p-2"
                          inputMode={metricKey === "altitudeM" ? "numeric" : "decimal"}
                          value={metric}
                          aria-invalid={metricValue === null}
                          disabled={saving}
                          onChange={(event) => setMetric(event.target.value)}
                        />
                        {metricValue === null ? <p role="alert">{t("invalidMetric")}</p> : null}
                      </label>
                    ) : null}
                  </>
                ) : (
                  <label>
                    <input
                      type="checkbox"
                      checked={required}
                      disabled={saving}
                      onChange={(event) => setRequired(event.target.checked)}
                    />{" "}
                    {t("required")}
                  </label>
                )}
                {error ? <p role="alert">{t(error)}</p> : null}
                <div className="flex flex-wrap gap-4">
                  <button
                    type="submit"
                    className="denali-wizard-composite__link"
                    disabled={
                      saving ||
                      !catalogReady ||
                      metricValue === null ||
                      error === "uncertain" ||
                      !name.trim() ||
                      (props.kind === "destination" && (!regionId || !typeAllowed))
                    }
                  >
                    {t(saving ? "saving" : "save")}
                  </button>
                  <button type="button" disabled={saving} onClick={() => dialog.current?.close()}>
                    {t("cancel")}
                  </button>
                </div>
              </form>
            </dialog>,
            document.body
          )
        : null}
    </>
  );
}
