/** Damavand northeast ridge ascent waypoints — i18n home.full.ascent.waypoints.{id}.* */
export const DAMAVAND_ASCENT_WAYPOINT_IDS = ["base", "shelter", "summit"] as const;

export type DamavandAscentWaypointId = (typeof DAMAVAND_ASCENT_WAYPOINT_IDS)[number];

export const DAMAVAND_ASCENT_WAYPOINT_PROGRESS: Readonly<Record<DamavandAscentWaypointId, number>> =
  {
    base: 0,
    shelter: 0.55,
    summit: 1,
  };
