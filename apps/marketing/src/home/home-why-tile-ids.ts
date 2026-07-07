/** Why Denali bento tile ids — i18n home.full.why.{id}.title|description */
export const HOME_WHY_TILE_IDS = ["guide", "safety", "equipment", "community"] as const;

export type HomeWhyTileId = (typeof HOME_WHY_TILE_IDS)[number];
