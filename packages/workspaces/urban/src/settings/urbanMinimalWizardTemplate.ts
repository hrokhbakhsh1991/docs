import { URBAN_FIELD_REGISTRY } from "../urban.plugin";

export type UrbanWizardTemplateFieldRef = {
  readonly canonicalPath: string;
  readonly required?: boolean;
};

export type UrbanWizardTemplateStepRef = {
  readonly stepId: string;
  readonly label: string;
  readonly enabled: boolean;
  readonly fields: readonly UrbanWizardTemplateFieldRef[];
};

export type UrbanMinimalWizardTemplatePayload = {
  readonly seedLabel: string;
  readonly published: true;
  readonly sections: readonly [];
  readonly steps: readonly UrbanWizardTemplateStepRef[];
};

const field = (canonicalPath: string, required?: boolean): UrbanWizardTemplateFieldRef => ({
  canonicalPath,
  ...(required === true ? { required: true } : {}),
});

/** Registry-backed minimal urban create wizard (P15-P-D0 step 1). */
export function buildUrbanMinimalWizardTemplateSteps(): readonly UrbanWizardTemplateStepRef[] {
  const reviewPaths = new Set(["tour.publishStatus"]);
  const mainFields = URBAN_FIELD_REGISTRY.fields
    .filter((entry) => !reviewPaths.has(entry.canonicalPath))
    .map((entry) => field(entry.canonicalPath, entry.required === true));

  return [
    {
      stepId: "urban_tour",
      label: "Tour details",
      enabled: true,
      fields: mainFields,
    },
    {
      stepId: "review",
      label: "Review",
      enabled: true,
      fields: [field("tour.publishStatus", true)],
    },
  ];
}

export function buildUrbanMinimalWizardTemplatePayload(
  seedLabel = "New urban tour"
): UrbanMinimalWizardTemplatePayload {
  return {
    seedLabel,
    published: true,
    sections: [],
    steps: buildUrbanMinimalWizardTemplateSteps(),
  };
}
