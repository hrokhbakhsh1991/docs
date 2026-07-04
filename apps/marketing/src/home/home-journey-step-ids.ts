/** Tour journey step ids — i18n home.full.journey.{id}.title|description */
export const HOME_JOURNEY_STEP_IDS = ["register", "prepare", "summit", "return"] as const;

export type HomeJourneyStepId = (typeof HOME_JOURNEY_STEP_IDS)[number];
