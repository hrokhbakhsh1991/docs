/** Static destination card ids — i18n home.full.destinations.{id}.name|description */
export const HOME_DESTINATION_IDS = ["alborz", "damavand", "zardkuh"] as const;

export type HomeDestinationId = (typeof HOME_DESTINATION_IDS)[number];
