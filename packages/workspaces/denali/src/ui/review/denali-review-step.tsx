"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import type { RenderStepPlan } from "@app-tour/platform-core";

import { loadDenaliReviewCatalog } from "../adapters/review-catalog-fetch";
import {
  resolveDenaliFieldLabel,
  resolveDenaliPublishStatusLabel,
  resolveDenaliTourKindLabel,
  resolveDenaliTransportModeLabel,
} from "../adapters/field-labels";
import { DenaliPhotoPreview } from "../components/denali-photo-preview";
import { EquipmentCatalogAvatar } from "../components/equipment-catalog-avatar";
import type { DenaliTourWizardDraft } from "../../draft/denali-tour-wizard-draft";
import type { DenaliGearItem } from "../logic/denali-gear-types";
import {
  buildDenaliReviewHero,
  buildDenaliReviewSectionsFromVisibleSteps,
  type DenaliReviewCatalog,
  type DenaliReviewFormatLabels,
  type DenaliReviewHero,
  type DenaliReviewRow,
  type DenaliReviewSection,
} from "../logic/denali-review-format-logic";
import type { DenaliTourPhoto } from "../logic/denali-photo-types";
import { DENALI_REVIEW_STEP_TEST_IDS } from "../test-ids/denali-review-test-ids";

export { DENALI_REVIEW_STEP_TEST_IDS } from "../test-ids/denali-review-test-ids";

const EMPTY_CATALOG: DenaliReviewCatalog = {
  destinationNameById: new Map(),
  leaderNameById: new Map(),
  themeNameById: new Map(),
  languageNameById: new Map(),
  equipmentIconKeyById: new Map(),
};

type DenaliReviewStepProps = {
  readonly draft: DenaliTourWizardDraft;
  readonly contentSteps: readonly RenderStepPlan[];
  readonly onNavigateToStep?: (stepId: string) => void;
};

function ReviewGrid({ rows }: { readonly rows: readonly DenaliReviewRow[] }) {
  if (rows.length === 0) {
    return null;
  }
  return (
    <dl className="denali-review__grid">
      {rows.map((row) => (
        <div key={`${row.label}:${row.value}`} className="denali-review__row">
          <dt className="denali-review__term">{row.label}</dt>
          <dd
            className={
              row.multiline
                ? "denali-review__value denali-review__value--multiline"
                : "denali-review__value"
            }
          >
            {row.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function ReviewPhotoGrid({
  photos,
  dayLabel,
  altFallback,
}: {
  readonly photos: readonly DenaliTourPhoto[];
  readonly dayLabel: (day: number) => string;
  readonly altFallback: string;
}) {
  if (photos.length === 0) {
    return null;
  }
  return (
    <div className="denali-review__photo-grid" data-testid={DENALI_REVIEW_STEP_TEST_IDS.photoGrid}>
      {photos.map((photo, index) => {
        const caption = photo.label?.trim();
        const day = photo.day;
        return (
          <figure
            key={photo.id ?? `photo-${index}`}
            className="denali-review__photo-card"
            data-denali-review-photo={photo.id ?? String(index)}
          >
            <DenaliPhotoPreview
              photo={photo}
              altFallback={altFallback}
              className="denali-review__photo-img"
              readOnly
            />
            {caption || day != null ? (
              <figcaption className="denali-review__photo-caption">
                {caption ? <span className="denali-review__photo-label">{caption}</span> : null}
                {day != null ? (
                  <span className="denali-review__photo-day">{dayLabel(day)}</span>
                ) : null}
              </figcaption>
            ) : null}
          </figure>
        );
      })}
    </div>
  );
}

function ReviewGearList({
  gearItems,
  equipmentIconKeyById,
  gearRequiredLabel,
  gearOptionalLabel,
}: {
  readonly gearItems: readonly DenaliGearItem[];
  readonly equipmentIconKeyById: ReadonlyMap<string, string | null>;
  readonly gearRequiredLabel: string;
  readonly gearOptionalLabel: string;
}) {
  if (gearItems.length === 0) {
    return null;
  }
  return (
    <ul className="denali-review__gear-list" aria-label="gear">
      {gearItems.map((item) => (
        <li
          key={item.equipmentId ?? item.name}
          className="denali-review__gear-item"
          data-denali-review-gear={item.equipmentId ?? item.name}
        >
          <div className="denali-review__gear-main">
            <EquipmentCatalogAvatar
              id={item.equipmentId || item.name}
              name={item.name}
              iconKey={
                item.equipmentId.length > 0
                  ? equipmentIconKeyById.get(item.equipmentId) ?? null
                  : null
              }
              className="denali-review__gear-avatar"
            />
            <span className="denali-review__gear-name">{item.name}</span>
          </div>
          <span
            className={
              item.isRequired
                ? "denali-review__gear-badge denali-review__gear-badge--required"
                : "denali-review__gear-badge denali-review__gear-badge--optional"
            }
          >
            {item.isRequired ? gearRequiredLabel : gearOptionalLabel}
          </span>
        </li>
      ))}
    </ul>
  );
}

function ReviewHero({
  hero,
  displayTitle,
}: {
  readonly hero: DenaliReviewHero;
  readonly displayTitle: string;
}) {
  const hasMeta =
    hero.destination.trim().length > 0 || hero.schedule.trim().length > 0;
  return (
    <header className="denali-review__hero" data-testid={DENALI_REVIEW_STEP_TEST_IDS.hero}>
      {hero.coverPhoto != null ? (
        <div className="denali-review__hero-media">
          <DenaliPhotoPreview
            photo={hero.coverPhoto}
            altFallback={displayTitle}
            className="denali-review__hero-cover"
            testId={DENALI_REVIEW_STEP_TEST_IDS.heroCover}
            readOnly
          />
        </div>
      ) : null}
      <div className="denali-review__hero-content">
        {hero.categoryLabel.trim().length > 0 ? (
          <div className="denali-review__hero-badges">
            <span className="denali-review__badge">{hero.categoryLabel}</span>
          </div>
        ) : null}
        <h3 className="denali-review__hero-title" data-testid={DENALI_REVIEW_STEP_TEST_IDS.title}>
          {displayTitle}
        </h3>
        {hasMeta ? (
          <p className="denali-review__hero-meta">
            {hero.destination.trim().length > 0 ? (
              <span data-testid={DENALI_REVIEW_STEP_TEST_IDS.destinationName}>
                {hero.destination}
              </span>
            ) : null}
            {hero.schedule.trim().length > 0 ? <span>{hero.schedule}</span> : null}
          </p>
        ) : null}
      </div>
    </header>
  );
}

function ReviewSectionBlock({
  section,
  equipmentIconKeyById,
  editSectionLabel,
  gearRequiredLabel,
  gearOptionalLabel,
  dayLabel,
  photoAltFallback,
  onNavigateToStep,
}: {
  readonly section: DenaliReviewSection;
  readonly equipmentIconKeyById: ReadonlyMap<string, string | null>;
  readonly editSectionLabel: string;
  readonly gearRequiredLabel: string;
  readonly gearOptionalLabel: string;
  readonly dayLabel: (day: number) => string;
  readonly photoAltFallback: string;
  readonly onNavigateToStep?: (stepId: string) => void;
}) {
  const hasBody =
    section.rows.length > 0 ||
    (section.chips?.length ?? 0) > 0 ||
    (section.cards?.length ?? 0) > 0 ||
    (section.photos?.length ?? 0) > 0 ||
    (section.gearItems?.length ?? 0) > 0;
  if (!hasBody) {
    return null;
  }

  return (
    <article
      className="denali-review__section"
      data-testid={DENALI_REVIEW_STEP_TEST_IDS.section(section.stepId)}
      data-denali-review-section={section.stepId}
    >
      <div className="denali-review__section-header">
        <h4 className="denali-review__section-title">{section.title}</h4>
        {onNavigateToStep != null ? (
          <button
            type="button"
            className="denali-review__section-edit"
            data-testid={DENALI_REVIEW_STEP_TEST_IDS.editSection(section.stepId)}
            onClick={() => onNavigateToStep(section.stepId)}
          >
            {editSectionLabel}
          </button>
        ) : null}
      </div>
      <div className="denali-review__section-body">
        <ReviewGrid rows={section.rows} />
        {section.photos != null && section.photos.length > 0 ? (
          <ReviewPhotoGrid
            photos={section.photos}
            dayLabel={dayLabel}
            altFallback={photoAltFallback}
          />
        ) : null}
        {section.gearItems != null && section.gearItems.length > 0 ? (
          <ReviewGearList
            gearItems={section.gearItems}
            equipmentIconKeyById={equipmentIconKeyById}
            gearRequiredLabel={gearRequiredLabel}
            gearOptionalLabel={gearOptionalLabel}
          />
        ) : null}
        {section.chips != null && section.chips.length > 0 ? (
          <ul className="denali-review__chips" aria-label={section.title}>
            {section.chips.map((chip) => (
              <li key={chip} className="denali-review__chip">
                {chip}
              </li>
            ))}
          </ul>
        ) : null}
        {section.cards != null && section.cards.length > 0 ? (
          <div className="denali-review__cards" role="list">
            {section.cards.map((card, index) => (
              <article
                key={`${card.title}:${index}`}
                role="listitem"
                className={
                  card.variant === "self"
                    ? "denali-review__card denali-review__card--self"
                    : "denali-review__card"
                }
                data-denali-review-card={card.kind ?? "text"}
              >
                {card.meta ? (
                  <p
                    className={
                      card.variant === "self"
                        ? "denali-review__card-meta denali-review__card-meta--muted"
                        : "denali-review__card-meta"
                    }
                  >
                    {card.meta}
                  </p>
                ) : null}
                <h5 className="denali-review__card-title">{card.title}</h5>
                {card.body ? <p className="denali-review__card-body">{card.body}</p> : null}
              </article>
            ))}
          </div>
        ) : null}
      </div>
    </article>
  );
}

export function DenaliReviewStep({
  draft,
  contentSteps,
  onNavigateToStep,
}: DenaliReviewStepProps) {
  const t = useTranslations("denali");
  const [catalog, setCatalog] = useState<DenaliReviewCatalog>(EMPTY_CATALOG);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void loadDenaliReviewCatalog()
      .then((loaded) => {
        if (!cancelled) {
          setCatalog(loaded);
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
  }, []);

  const labels = useMemo((): DenaliReviewFormatLabels => {
    return {
      fieldLabel: (canonicalPath) => resolveDenaliFieldLabel(t, canonicalPath),
      stepLabel: (stepId) => t(`steps.${stepId}`),
      tourKindLabel: (slug) => resolveDenaliTourKindLabel(t, slug),
      transportModeLabel: (mode) => resolveDenaliTransportModeLabel(t, mode),
      publishStatusLabel: (status) => resolveDenaliPublishStatusLabel(t, status),
      locationZoneLabel: (path) => t(`composites.locationTypes.${path}`),
      yes: t("review.yes"),
      no: t("review.no"),
      gearRequired: t("review.gearRequired"),
      gearOptional: t("review.gearOptional"),
      photoCount: (count) => t("review.photoCount", { count }),
      dayLabel: (day) => t("review.dayLabel", { day }),
      primaryGathering: t("review.primaryGathering"),
      socialMediaTelegramAutoLabel: t("composites.socialMedia.reviewTelegramAuto"),
    };
  }, [t]);

  const hero = useMemo(
    () => buildDenaliReviewHero(draft, catalog, labels),
    [draft, catalog, labels]
  );
  const sections = useMemo(
    () => buildDenaliReviewSectionsFromVisibleSteps(draft, contentSteps, catalog, labels),
    [draft, contentSteps, catalog, labels]
  );

  const displayTitle =
    hero.title.trim().length > 0 ? hero.title : t("review.untitledTour");

  return (
    <section className="denali-review" data-testid={DENALI_REVIEW_STEP_TEST_IDS.panel}>
      <p className="denali-review__intro">{t("review.intro")}</p>
      {loading ? <p className="denali-review__status">{t("review.loading")}</p> : null}

      <ReviewHero hero={hero} displayTitle={displayTitle} />

      <div className="denali-review__sections">
        {sections.map((section) => (
          <ReviewSectionBlock
            key={section.stepId}
            section={section}
            equipmentIconKeyById={catalog.equipmentIconKeyById}
            editSectionLabel={t("review.editSection")}
            gearRequiredLabel={t("review.gearRequired")}
            gearOptionalLabel={t("review.gearOptional")}
            dayLabel={(day) => t("review.dayLabel", { day })}
            photoAltFallback={displayTitle}
            onNavigateToStep={onNavigateToStep}
          />
        ))}
      </div>
    </section>
  );
}
