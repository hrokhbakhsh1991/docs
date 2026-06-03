/** Shared golden render plan for starter-shaped plugins (variant: default). */
export const STARTER_PLAN_SNAPSHOT = JSON.stringify([
  {
    stepId: "basics",
    fields: [
      {
        fieldId: "basics.title",
        kind: "text",
        canonicalPath: "basics.title",
        required: true,
        hidden: false,
        stepId: "basics",
      },
    ],
  },
  {
    stepId: "details",
    fields: [
      {
        fieldId: "details.summary",
        kind: "text",
        canonicalPath: "details.summary",
        required: false,
        hidden: false,
        stepId: "details",
      },
    ],
  },
]);
