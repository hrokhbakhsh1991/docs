export const VALIDATION_TIME_BUDGET_EXCEEDED = "VALIDATION_TIME_BUDGET_EXCEEDED";

const DEFAULT_TIME_BUDGET_MS = 10_000;

export class ValidationTimeBudgetExceededError extends Error {
  readonly code = VALIDATION_TIME_BUDGET_EXCEEDED;

  constructor(public readonly budgetMs: number) {
    super(VALIDATION_TIME_BUDGET_EXCEEDED);
    this.name = "ValidationTimeBudgetExceededError";
  }
}

export function isValidationTimeBudgetExceededError(
  error: unknown
): error is ValidationTimeBudgetExceededError {
  return error instanceof ValidationTimeBudgetExceededError;
}

export function resolveValidationTimeBudgetMs(): number {
  const raw = process.env.P5_VALIDATION_TIME_BUDGET_MS?.trim();
  if (!raw) {
    return DEFAULT_TIME_BUDGET_MS;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 1 ? parsed : DEFAULT_TIME_BUDGET_MS;
}

export function isValidationWorkersEnabled(): boolean {
  if (process.env.P5_VALIDATION_WORKERS_ENABLED?.trim().toLowerCase() === "false") {
    return false;
  }
  return resolveValidationWorkerPoolSize() > 0;
}

export function resolveValidationWorkerPoolSize(): number {
  const raw = process.env.P5_VALIDATION_WORKER_POOL_SIZE?.trim();
  if (!raw) {
    return 2;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 2;
  }
  return parsed;
}
