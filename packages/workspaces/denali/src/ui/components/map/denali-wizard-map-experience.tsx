"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import {
  DenaliLocationPickerMap,
  type DenaliMapCoordinates,
} from "./denali-location-picker-map";

export type DenaliWizardMapExperienceProps = {
  readonly value: DenaliMapCoordinates;
  readonly onChange: (_coords: { latitude: number; longitude: number }) => void;
  readonly testIdKey: string;
  readonly mapTestId?: string;
  readonly deferred?: boolean;
};

export function DenaliWizardMapExperience({
  value,
  onChange,
  testIdKey,
  mapTestId,
  deferred = false,
}: DenaliWizardMapExperienceProps) {
  const t = useTranslations("denali.composites.location");
  const titleId = useId();
  const dialogId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const openButtonRef = useRef<HTMLButtonElement>(null);
  const doneButtonRef = useRef<HTMLButtonElement>(null);
  const [expandedMounted, setExpandedMounted] = useState(false);
  const resolvedMapTestId = mapTestId ?? `denali-location-${testIdKey}-map`;

  const openExpanded = useCallback(() => {
    const dialog = dialogRef.current;
    if (dialog == null || dialog.open) {
      return;
    }
    setExpandedMounted(true);
    dialog.showModal();
    window.requestAnimationFrame(() => {
      doneButtonRef.current?.focus();
    });
  }, []);

  const closeExpanded = useCallback(() => {
    dialogRef.current?.close();
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog == null) {
      return;
    }
    const handleClose = () => {
      setExpandedMounted(false);
      window.requestAnimationFrame(() => {
        openButtonRef.current?.focus();
      });
    };
    const handleCancel = (event: Event) => {
      event.preventDefault();
      dialog.close();
    };
    dialog.addEventListener("close", handleClose);
    dialog.addEventListener("cancel", handleCancel);
    return () => {
      dialog.removeEventListener("close", handleClose);
      dialog.removeEventListener("cancel", handleCancel);
    };
  }, []);

  if (deferred) {
    return (
      <p
        className="denali-wizard-composite__location-map-hint"
        data-testid={`denali-location-${testIdKey}-map-deferred`}
      >
        {t("mapDeferredHint")}
      </p>
    );
  }

  return (
    <div
      className="denali-wizard-map-experience"
      data-testid={`denali-wizard-map-experience-${testIdKey}`}
      data-wizard-map-expanded={expandedMounted ? "true" : "false"}
    >
      <div className="denali-wizard-map-experience__preview">
        <DenaliLocationPickerMap
          value={value}
          onChange={onChange}
          interactionMode="preview"
          data-testid={`${resolvedMapTestId}-preview`}
        />
        <div className="denali-wizard-map-experience__preview-overlay" aria-hidden={false}>
          <button
            ref={openButtonRef}
            type="button"
            className="denali-wizard-map-experience__open"
            onClick={openExpanded}
            aria-haspopup="dialog"
            aria-controls={dialogId}
            data-testid={`denali-wizard-map-open-${testIdKey}`}
          >
            {t("openMap")}
          </button>
        </div>
      </div>

      <p className="denali-wizard-composite__location-map-hint">{t("mapExpandedHint")}</p>

      <dialog
        ref={dialogRef}
        id={dialogId}
        className="denali-wizard-map-dialog"
        aria-labelledby={titleId}
        data-testid={`denali-wizard-map-dialog-${testIdKey}`}
      >
        <header className="denali-wizard-map-dialog__header">
          <h4 id={titleId} className="denali-wizard-map-dialog__title">
            {t("expandedMapTitle")}
          </h4>
          <button
            ref={doneButtonRef}
            type="button"
            className="denali-wizard-map-dialog__done"
            onClick={closeExpanded}
            data-testid={`denali-wizard-map-close-${testIdKey}`}
          >
            {t("doneMap")}
          </button>
        </header>
        <div className="denali-wizard-map-dialog__body">
          {expandedMounted ? (
            <DenaliLocationPickerMap
              value={value}
              onChange={onChange}
              interactionMode="expanded"
              data-testid={`${resolvedMapTestId}-expanded`}
            />
          ) : null}
        </div>
      </dialog>
    </div>
  );
}
