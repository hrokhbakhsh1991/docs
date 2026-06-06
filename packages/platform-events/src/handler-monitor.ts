const DEFAULT_HANDLER_BUDGET_MS = 10;

let slowHandlerTotal = 0;

export function resolveDomainEventHandlerBudgetMs(): number {
  const raw = process.env.DOMAIN_EVENT_HANDLER_BUDGET_MS?.trim();
  if (raw === undefined || raw.length === 0) {
    return DEFAULT_HANDLER_BUDGET_MS;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_HANDLER_BUDGET_MS;
  }
  return parsed;
}

export function recordDomainEventHandlerDuration(eventType: string, durationMs: number): void {
  if (!Number.isFinite(durationMs) || durationMs < 0) {
    return;
  }
  if (durationMs > resolveDomainEventHandlerBudgetMs()) {
    slowHandlerTotal += 1;
    void eventType;
  }
}

export function readDomainEventHandlerSlowTotal(): number {
  return slowHandlerTotal;
}

/** Test-only — reset slow-handler counter between specs. */
export function resetDomainEventHandlerMonitorForTests(): void {
  slowHandlerTotal = 0;
}
