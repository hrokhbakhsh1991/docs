import type { CaseEncounterLabelBundle } from "../labels";
import type { CaseEncounterViewContract } from "../contract";

export type EncounterConfidenceSectionProps = {
  readonly encounter: CaseEncounterViewContract;
  readonly labels: CaseEncounterLabelBundle;
};

/** Confidence — all four meanings as text (not color-only). */
export function EncounterConfidenceSection({
  encounter,
  labels,
}: EncounterConfidenceSectionProps) {
  const { confidence } = encounter;
  return (
    <section
      data-testid="case-encounter-confidence"
      data-channel="verdict"
      aria-labelledby="case-encounter-confidence-heading"
    >
      <h2 id="case-encounter-confidence-heading">{labels.sections.confidence}</h2>
      <dl>
        <div>
          <dt>{labels.fields.whyVisible}</dt>
          <dd data-testid="case-encounter-why-visible">{confidence.whyVisible}</dd>
        </div>
        <div>
          <dt>{labels.fields.whyMineOrNot}</dt>
          <dd data-testid="case-encounter-why-mine">{confidence.whyMineOrNot}</dd>
        </div>
        <div>
          <dt>{labels.fields.ifIWait}</dt>
          <dd data-testid="case-encounter-if-i-wait">{confidence.ifIWait}</dd>
        </div>
        <div>
          <dt>{labels.fields.avoid}</dt>
          <dd data-testid="case-encounter-avoid">{confidence.avoid}</dd>
        </div>
      </dl>
    </section>
  );
}
