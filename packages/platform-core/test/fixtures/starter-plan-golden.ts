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
      {
        fieldId: "basics.featured",
        kind: "boolean",
        canonicalPath: "basics.featured",
        required: false,
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
      {
        fieldId: "details.status",
        kind: "enum",
        canonicalPath: "details.status",
        required: false,
        hidden: false,
        stepId: "details",
        uiHints: { enumOptions: '["draft","open","published"]' },
      },
    ],
  },
]);
