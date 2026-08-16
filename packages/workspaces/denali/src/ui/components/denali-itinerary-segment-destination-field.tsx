"use client";

import { useTranslations } from "next-intl";

import { DenaliSearchableSelect } from "../components/denali-searchable-select";
import { DenaliCatalogLoadNotice } from "../components/denali-catalog-load-notice";
import { DenaliDestinationOfferedEmptyNotice } from "../components/denali-destination-offered-empty-notice";
import { useDenaliDestinationCatalog, readDenaliDestinationLabel } from "../hooks/use-destination-catalog";
import { filterDenaliDestinationPickerOptions } from "../logic/denali-destination-picker-filter";
import { buildItinerarySegmentDestinationSelection } from "../logic/denali-itinerary-segment-destination-logic";
import { DENALI_ITINERARY_SEGMENT_DESTINATION_TEST_IDS } from "../test-ids/denali-photos-test-ids";

export { DENALI_ITINERARY_SEGMENT_DESTINATION_TEST_IDS } from "../test-ids/denali-photos-test-ids";

type DenaliItinerarySegmentDestinationFieldProps = {
  readonly destinationId?: string;
  readonly tourKind?: string;
  readonly onChange: (selection: {
    readonly destinationId?: string;
    readonly locationLabel?: string;
  }) => void;
};

export function DenaliItinerarySegmentDestinationField({
  destinationId,
  tourKind = "",
  onChange,
}: DenaliItinerarySegmentDestinationFieldProps) {
  const t = useTranslations("denali");
  const { options, destinationById, loading, error, reload } = useDenaliDestinationCatalog({
    tourKind,
  });
  const selectedLabel = readDenaliDestinationLabel(destinationId, destinationById);
  const visibleOptions = filterDenaliDestinationPickerOptions({
    options,
    destinationById,
    tourKind,
    selectedDestinationId: destinationId,
  });

  return (
    <div className="denali-wizard-composite__field">
      <label className="denali-wizard-composite__field">
        <span>{t("composites.itinerary.segmentDestination")}</span>
        <div data-testid={DENALI_ITINERARY_SEGMENT_DESTINATION_TEST_IDS.select}>
          <DenaliSearchableSelect
            ariaLabel={t("composites.itinerary.segmentDestination")}
            options={visibleOptions}
            value={destinationId ?? ""}
            placeholder={
              loading
                ? t("composites.destination.loadingPlaceholder")
                : t("composites.itinerary.segmentDestinationPlaceholder")
            }
            loading={loading}
            searchableThreshold={0}
            searchLabel={t("composites.destination.searchLabel")}
            searchPlaceholder={t("composites.destination.searchPlaceholder")}
            searchEmptyMessage={t("composites.destination.searchEmpty")}
            onChange={(nextId) => {
              onChange(buildItinerarySegmentDestinationSelection(nextId, destinationById));
            }}
          />
        </div>
        {selectedLabel != null ? (
          <p className="denali-wizard-composite__helper">{selectedLabel}</p>
        ) : null}
      </label>
      <DenaliCatalogLoadNotice error={error} onRetry={reload} />
      {visibleOptions.length === 0 && !loading && error === null ? (
        <DenaliDestinationOfferedEmptyNotice onRetry={reload} />
      ) : null}
    </div>
  );
}
