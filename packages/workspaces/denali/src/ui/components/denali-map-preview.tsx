"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import {
  DENALI_COMPOSITE_TEST_IDS,
  openStreetMapEmbedUrl,
  openStreetMapLink,
} from "../logic/denali-location-types";

type DenaliMapPreviewProps = {
  readonly latitude?: number;
  readonly longitude?: number;
};

export function DenaliMapPreview({ latitude, longitude }: DenaliMapPreviewProps) {
  const t = useTranslations("denali");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setLoaded(false);
  }, [latitude, longitude]);

  if (
    latitude === undefined ||
    longitude === undefined ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude)
  ) {
    return null;
  }

  return (
    <div
      className="denali-wizard-composite__map-wrap"
      data-operator-wizard-map-preview
      data-testid={DENALI_COMPOSITE_TEST_IDS.mapPreview}
    >
      {!loaded ? <div className="denali-wizard-composite__map-skeleton" aria-hidden /> : null}
      <iframe
        title={t("composites.location.mapPreviewTitle")}
        className="denali-wizard-composite__map"
        src={openStreetMapEmbedUrl(latitude, longitude)}
        loading="lazy"
        onLoad={() => setLoaded(true)}
      />
      <a
        href={openStreetMapLink(latitude, longitude)}
        target="_blank"
        rel="noreferrer"
        className="denali-wizard-composite__link"
      >
        {t("composites.location.openFullMapLink")}
      </a>
    </div>
  );
}
