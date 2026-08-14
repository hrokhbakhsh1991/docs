import type { CaseEncounterViewContract } from "./contract";
import type { CaseCommandCapabilityContract } from "./command-capability";
import {
  DEFAULT_CASE_ENCOUNTER_LABELS,
  type CaseEncounterLabelBundle,
} from "./labels";
import { EncounterAttentionSection } from "./sections/attention";
import { EncounterCommandCapabilitySection } from "./sections/command-capability";
import { EncounterCompletenessSection } from "./sections/completeness";
import { EncounterConfidenceSection } from "./sections/confidence";
import { EncounterExplanationSection } from "./sections/explanation";
import { EncounterIdentitySection } from "./sections/identity";
import { EncounterOwnershipSection } from "./sections/ownership";

export type CaseEncounterReadOnlyScreenProps = {
  readonly encounter: CaseEncounterViewContract;
  /** Host-resolved display label — never used to alter verdict. */
  readonly counterpartyLabel?: string;
  readonly labels?: CaseEncounterLabelBundle;
  /** Show allow/forbid as non-interactive hints (default true). */
  readonly showVocabularyHints?: boolean;
  /** PR14-B / PR17-A — command capability metadata only (no buttons). */
  readonly commandCapability?: CaseCommandCapabilityContract;
};

/**
 * Read-only Case encounter composition.
 * Renders EncounterView fields only — no repositories, adapters, or mutations.
 */
export function CaseEncounterReadOnlyScreen({
  encounter,
  counterpartyLabel,
  labels = DEFAULT_CASE_ENCOUNTER_LABELS,
  showVocabularyHints = true,
  commandCapability,
}: CaseEncounterReadOnlyScreenProps) {
  return (
    <article
      data-testid="case-encounter-read-only-screen"
      data-case-key={encounter.caseKey}
      data-subject-kind={encounter.subjectKind}
    >
      <EncounterAttentionSection encounter={encounter} labels={labels} />
      <EncounterIdentitySection
        encounter={encounter}
        labels={labels}
        counterpartyLabel={counterpartyLabel}
      />
      <EncounterExplanationSection encounter={encounter} labels={labels} />
      <EncounterOwnershipSection encounter={encounter} labels={labels} />
      <EncounterConfidenceSection encounter={encounter} labels={labels} />
      <EncounterCompletenessSection encounter={encounter} labels={labels} />
      {showVocabularyHints ? (
        <section
          data-testid="case-encounter-vocabulary"
          data-channel="hint"
          aria-labelledby="case-encounter-vocabulary-heading"
        >
          <h2 id="case-encounter-vocabulary-heading">{labels.sections.vocabularyHints}</h2>
          <div>
            <h3>{labels.fields.allow}</h3>
            <ul data-testid="case-encounter-allow">
              {encounter.allow.map((token) => (
                <li key={`allow-${token}`}>
                  <span data-vocabulary="allow">{token}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3>{labels.fields.forbid}</h3>
            <ul data-testid="case-encounter-forbid">
              {encounter.forbid.map((token) => (
                <li key={`forbid-${token}`}>
                  <span data-vocabulary="forbid">{token}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}
      {commandCapability !== undefined ? (
        <EncounterCommandCapabilitySection capability={commandCapability} labels={labels} />
      ) : null}
    </article>
  );
}
