/** TypeORM entity class names (relation targets without importing entity modules). */
export const TOUR_ENTITY = "TourEntity";
export const TOUR_DETAILS_ENTITY = "TourDetails";
export const TOUR_PRODUCT_ENTITY = "TourProductEntity";
export const TOUR_DEPARTURE_ENTITY = "TourDepartureEntity";
export const TOUR_PRICE_ENTITY = "TourPriceEntity";

/** Relation typing for {@link TOUR_ENTITY} without importing the entity class. */
export interface ITourEntity {
  id: string;
  details?: ITourDetails;
}

/** Relation typing for {@link TOUR_DETAILS_ENTITY} without importing the entity class. */
export interface ITourDetails {
  id: string;
  tourId: string;
  tour: ITourEntity;
}

export interface ITourProductEntity {
  id: string;
  departures?: ITourDepartureEntity[];
}

export interface ITourDepartureEntity {
  id: string;
  tourProduct?: ITourProductEntity;
  prices?: ITourPriceEntity[];
}

export interface ITourPriceEntity {
  id: string;
  tourDeparture?: ITourDepartureEntity;
}
