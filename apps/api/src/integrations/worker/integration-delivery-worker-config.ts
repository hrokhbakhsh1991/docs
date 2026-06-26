export function isIntegrationDeliveryWorkerEnabled(): boolean {
  return process.env.INTEGRATION_DELIVERY_WORKER_ENABLED?.trim().toLowerCase() === "true";
}

export function readIntegrationDeliveryPollIntervalMs(): number {
  const raw = process.env.INTEGRATION_DELIVERY_POLL_INTERVAL_MS?.trim();
  const parsed = raw !== undefined ? Number.parseInt(raw, 10) : 2000;
  return Number.isFinite(parsed) && parsed >= 500 ? parsed : 2000;
}
