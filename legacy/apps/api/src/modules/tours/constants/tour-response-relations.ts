/** Default TypeORM relation graph for tour API responses (list/detail). */
export const TOUR_RESPONSE_RELATIONS = {
  details: true,
  destination: { region: true }
} as const;
