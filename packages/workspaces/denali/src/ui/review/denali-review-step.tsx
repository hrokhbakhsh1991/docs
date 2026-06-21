"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import { loadDenaliReviewCatalog } from "../adapters/review-catalog-fetch";
import {
  resolveDenaliFieldLabel,
  resolveDenaliPublishStatusLabel,
  resolveDenaliTourKindLabel,
  resolveDenaliTransportModeLabel,
} from "../adapters/field-labels";
import type { DenaliTourWizardDraft } from "../../draft/denali-tour-wizard-draft";
import {
  buildDenaliReviewHero,
  buildDenaliReviewSections,
  type DenaliReviewCatalog,
  type DenaliReviewFormatLabels,
  type DenaliReviewRow,
  type DenaliReviewSection,
} from "../logic/denali-review-format-logic";
import { DENALI_REVIEW_STEP_TEST_IDS } from "../test-ids/denali-review-test-ids";

export { DENALI_REVIEW_STEP_TEST_IDS } from "../test-ids/denali-review-test-ids";

const EMPTY_CATALOG: DenaliReviewCatalog = {
  destinationNameById: new Map(),
  leaderNameById: new Map(),
  themeNameById: new Map(),
  languageNameById: new Map(),
};

type DenaliReviewStepProps = {
  readonly draft: DenaliTourWizardDraft;
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

function ReviewSectionBlock({ section }: { readonly section: DenaliReviewSection }) {
  const hasBody =
    section.rows.length > 0 ||
    (section.chips?.length ?? 0) > 0 ||
    (section.cards?.length ?? 0) > 0;
  if (!hasBody) {
    return null;
  }

  return (
    <article
      className="denali-review__section"
      data-testid={DENALI_REVIEW_STEP_TEST_IDS.section(section.stepId)}
      data-denali-review-section={section.stepId}
    >
      <h4 className="denali-review__section-title">{section.title}</h4>
      <div className="denali-review__section-body">
        <ReviewGrid rows={section.rows} />
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

export function DenaliReviewStep({ draft }: DenaliReviewStepProps) {
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
    };
  }, [t]);

  const hero = useMemo(
    () => buildDenaliReviewHero(draft, catalog, labels),
    [draft, catalog, labels]
  );
  const sections = useMemo(
    () => buildDenaliReviewSections(draft, catalog, labels),
    [draft, catalog, labels]
  );

  const displayTitle =
    hero.title.trim().length > 0 ? hero.title : t("review.untitledTour");

  return (
    <section className="denali-review" data-testid={DENALI_REVIEW_STEP_TEST_IDS.panel}>
      <p className="denali-review__intro">{t("review.intro")}</p>
      {loading ? <p className="denali-review__status">{t("review.loading")}</p> : null}

      <header className="denali-review__hero" data-testid={DENALI_REVIEW_STEP_TEST_IDS.hero}>
        {hero.categoryLabel.trim().length > 0 ? (
          <div className="denali-review__hero-badges">
            <span className="denali-review__badge">{hero.categoryLabel}</span>
          </div>
        ) : null}
        <h3 className="denali-review__hero-title" data-testid={DENALI_REVIEW_STEP_TEST_IDS.title}>
          {displayTitle}
        </h3>
        <p className="denali-review__hero-meta">
          {hero.destination.trim().length > 0 ? (
            <span data-testid={DENALI_REVIEW_STEP_TEST_IDS.destinationName}>{hero.destination}</span>
          ) : null}
          {hero.schedule.trim().length > 0 ? <span>{hero.schedule}</span> : null}
        </p>
      </header>

      <div className="denali-review__sections">
        {sections.map((section) => (
          <ReviewSectionBlock key={section.stepId} section={section} />
        ))}
      </div>
    </section>
  );
}
