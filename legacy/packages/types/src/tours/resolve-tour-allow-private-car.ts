export type TourAllowPrivateCarInput = {
  transportModes?: string[];
  details?: {
    tripDetails?: {
      transport?: { allowPersonalCar?: boolean };
      logistics?: { primaryTransportMode?: string };
    };
  };
};

/** Whether travelers may register with `transportMode: self_vehicle`. */
export function resolveTourAllowPrivateCar(tour: TourAllowPrivateCarInput): boolean {
  const modes = (tour.transportModes ?? []).map((m) => m.toLowerCase());
  if (modes.includes("private_car")) {
    return true;
  }
  const td = tour.details?.tripDetails;
  if (td?.transport?.allowPersonalCar === true) {
    return true;
  }
  if (td?.logistics?.primaryTransportMode?.toLowerCase() === "private_car") {
    return true;
  }
  return false;
}
