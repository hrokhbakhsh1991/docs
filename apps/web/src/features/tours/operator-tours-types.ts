export type TourUiStatus = "draft" | "active" | "archived";

export type TourListProjection = {
  readonly id: string;
  readonly tenantId: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly rowVersion: number;
  readonly title: string;
  readonly shortDescription: string | null;
  readonly listStatus: string;
  readonly uiStatus: TourUiStatus;
  readonly priceAmount: number | null;
  readonly priceCurrency: string | null;
  readonly totalCapacity: number | null;
  readonly acceptedCount: number;
  readonly category: string | null;
  readonly coverImageUrl: string | null;
  readonly coverImageStorageKey: string | null;
  readonly departureAt: string | null;
};

export type OperatorTourListResponse = {
  readonly items: readonly TourListProjection[];
  readonly total: number;
  readonly page: number;
  readonly limit: number;
};
