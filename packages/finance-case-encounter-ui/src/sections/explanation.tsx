import type { CaseEncounterLabelBundle } from "../labels";
import type { CaseEncounterViewContract } from "../contract";

export type EncounterExplanationSectionProps = {
  readonly encounter: CaseEncounterViewContract;
  readonly labels: CaseEncounterLabelBundle;
};

/** Explanation — verdict channel (headline + reading). */
export function EncounterExplanationSection({
  encounter,
  labels,
}: EncounterExplanationSectionProps) {
  const { explainability } = encounter;
  return (
    <section
      data-testid="case-encounter-explanation"
      data-channel="verdict"
      aria-labelledby="case-encounter-explanation-heading"
    >
      <h2 id="case-encounter-explanation-heading">{labels.sections.explanation}</h2>
      <p data-testid="case-encounter-headline">{explainability.headline}</p>
      <dl>
        <div>
          <dt>{labels.fields.reading}</dt>
          <dd data-testid="case-encounter-reading">
            {labels.reading[explainability.reading]}
          </dd>
        </div>
      </dl>
    </section>
  );
}
