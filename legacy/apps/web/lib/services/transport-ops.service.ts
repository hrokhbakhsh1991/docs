export type TransportPlanDriverNotifyRow = {
  driverId: string;
  driverName: string;
  availableSeats: number;
  passengerNames: string[];
};

export type NotifyDriversResult = {
  tourId: string;
  channel: "sms" | "push";
  driversNotified: number;
  sentAt: string;
};

/**
 * Placeholder: simulates distributing the final carpool plan to drivers (SMS/push).
 */
export async function notifyDrivers(
  tourId: string,
  plan: { drivers: TransportPlanDriverNotifyRow[] },
): Promise<NotifyDriversResult> {
  await new Promise((resolve) => setTimeout(resolve, 600));

  const driverCount = plan.drivers.filter((d) => d.passengerNames.length > 0 || d.availableSeats > 0).length;

  return {
    tourId,
    channel: "sms",
    driversNotified: driverCount,
    sentAt: new Date().toISOString(),
  };
}
