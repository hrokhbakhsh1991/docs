export class TourCapacityExceededError extends Error {
  constructor(
    readonly code: "TOUR_CAPACITY_TENANT" | "TOUR_CAPACITY_GLOBAL",
    message: string
  ) {
    super(message);
    this.name = "TourCapacityExceededError";
  }
}

export function tourCapacityErrorMessage(code: TourCapacityExceededError["code"]): string {
  return `TOUR_CAPACITY_EXCEEDED_${code}`;
}
