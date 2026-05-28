export const REGISTRATION_ENTITY = "RegistrationEntity";
export const BOOKING_PRICE_SNAPSHOT_ENTITY = "BookingPriceSnapshotEntity";

export interface IRegistrationEntity {
  id: string;
  priceSnapshot?: IBookingPriceSnapshotEntity | null;
}

export interface IBookingPriceSnapshotEntity {
  snapshotId: string;
  booking: IRegistrationEntity;
}
