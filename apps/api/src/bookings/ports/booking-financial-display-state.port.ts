import type { BookingListItem } from "@app-tour/booking-http-contracts";

import type { BookingRecord } from "../bookings.types";

export type BookingFinancialDisplayStatePort = {
  readonly resolve: (record: BookingRecord) => BookingListItem["financialDisplayState"];
};
