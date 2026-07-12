import fs from "node:fs";
import { Worker } from "node:worker_threads";
import path from "node:path";
import { pathToFileURL } from "node:url";

import type { CanonicalDocument } from "@app-tour/workspace-sdk";

import { SchemaVersionMismatchError } from "./schema-version-mismatch";
import { ValidationFailure } from "./validation-failure";
import {
  isValidationWorkersEnabled,
  resolveValidationTimeBudgetMs,
  resolveValidationWorkerPoolSize,
  ValidationTimeBudgetExceededError,
} from "./validation-time-budget";
import {
  validateCanonicalBeforePersistSync,
  type ValidateBeforePersistInput,
} from "../tours/canonical-validation-sync";
import { requiresValidationSync } from "./workspace-canonical-tour-dispatch.ts";
import { metricsRegistry } from "../observability/metrics";

type WorkerRequest = {
  readonly jobId: number;
  readonly input: ValidateBeforePersistInput;
};

type WorkerSuccess = {
  readonly jobId: number;
  readonly ok: true;
  readonly document: CanonicalDocument;
};

type WorkerFailure = {
  readonly jobId: number;
  readonly ok: false;
  readonly error: {
    readonly name: string;
    readonly message: string;
    readonly code?: string;
  };
};

type WorkerResponse = WorkerSuccess | WorkerFailure;

type JobRecord = {
  readonly jobId: number;
  readonly input: ValidateBeforePersistInput;
  readonly tenantId: string;
  readonly resolve: (document: CanonicalDocument) => void;
  readonly reject: (error: unknown) => void;
  readonly timer: ReturnType<typeof setTimeout>;
  settled: boolean;
};

let pool: ValidationWorkerPool | undefined;

function workerExecArgv(): string[] {
  // Node workers reject most parent execArgv flags (ERR_WORKER_INVALID_EXEC_ARGV).
  return ["--import", "tsx"];
}

function resolveWorkerScriptPath(): string {
  const sameDirTs = path.join(__dirname, "validation-worker-entry.ts");
  if (fs.existsSync(sameDirTs)) {
    return sameDirTs;
  }
  const candidates = [
    path.join(__dirname, "validation-worker-entry.js"),
    path.join(__dirname, "../../dist/canonical/validation-worker-entry.js"),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  const ext = path.extname(__filename) === ".ts" ? ".ts" : ".js";
  return path.join(__dirname, `validation-worker-entry${ext}`);
}

function createWorker(): Worker {
  const scriptPath = resolveWorkerScriptPath();
  const workerTarget = scriptPath.endsWith(".js") ? pathToFileURL(scriptPath) : scriptPath;
  // tsx resolves extensionless ESM imports in dist output (worker thread has no Bundler resolver).
  return new Worker(workerTarget, {
    execArgv: workerExecArgv(),
  });
}

function parseSchemaVersionMismatchMessage(message: string): SchemaVersionMismatchError | null {
  const match = message.match(/SCHEMA_VERSION_MISMATCH: requested (\d+), workspace current (\d+)/);
  if (match === null) {
    return null;
  }
  return new SchemaVersionMismatchError(Number(match[1]), Number(match[2]));
}

function rehydrateWorkerError(error: WorkerFailure["error"]): Error {
  if (error.name === "ValidationFailure") {
    return new ValidationFailure(error.message, error.code ?? "VALIDATION_FAILURE");
  }
  if (error.name === "SchemaVersionMismatchError" || error.code === "SCHEMA_VERSION_MISMATCH") {
    return parseSchemaVersionMismatchMessage(error.message) ?? new Error(error.message);
  }
  return new Error(error.message);
}

class ValidationWorkerPool {
  private readonly workers: Worker[] = [];
  private readonly idleWorkers: Worker[] = [];
  private readonly jobs = new Map<number, JobRecord>();
  private readonly queuedJobIds: number[] = [];
  private readonly workerJob = new Map<Worker, number>();
  private nextJobId = 1;

  constructor(size: number) {
    for (let index = 0; index < size; index += 1) {
      this.registerWorker(createWorker());
    }
  }

  private attachWorkerListeners(worker: Worker): void {
    worker.on("message", (message: WorkerResponse) => this.onWorkerMessage(worker, message));
    worker.on("error", (error) => this.onWorkerError(worker, error));
  }

  private registerWorker(worker: Worker): void {
    this.attachWorkerListeners(worker);
    this.workers.push(worker);
    this.idleWorkers.push(worker);
  }

  private replaceWorker(failed: Worker): Worker {
    const replacement = createWorker();
    this.attachWorkerListeners(replacement);

    const workerIndex = this.workers.indexOf(failed);
    if (workerIndex >= 0) {
      this.workers[workerIndex] = replacement;
    }

    const idleIndex = this.idleWorkers.indexOf(failed);
    if (idleIndex >= 0) {
      this.idleWorkers[idleIndex] = replacement;
    }

    void failed.terminate();
    return replacement;
  }

  run(input: ValidateBeforePersistInput): Promise<CanonicalDocument> {
    const budgetMs = resolveValidationTimeBudgetMs();
    const tenantId = input.tenantId.trim();

    return new Promise<CanonicalDocument>((resolve, reject) => {
      const jobId = this.nextJobId++;
      const timer = setTimeout(() => {
        this.failJob(jobId, new ValidationTimeBudgetExceededError(budgetMs));
        metricsRegistry.increment("validation_time_budget_exceeded_total", {
          tenant_id: tenantId,
        });
      }, budgetMs);

      const job: JobRecord = {
        jobId,
        input,
        tenantId,
        resolve: (document) => {
          clearTimeout(timer);
          resolve(document);
        },
        reject: (error) => {
          clearTimeout(timer);
          reject(error);
        },
        timer,
        settled: false,
      };

      this.jobs.set(jobId, job);
      this.queuedJobIds.push(jobId);
      this.pumpQueue();
    });
  }

  private pumpQueue(): void {
    while (this.queuedJobIds.length > 0 && this.idleWorkers.length > 0) {
      const jobId = this.queuedJobIds.shift()!;
      const job = this.jobs.get(jobId);
      if (job === undefined || job.settled) {
        continue;
      }
      const worker = this.idleWorkers.pop()!;
      this.workerJob.set(worker, jobId);
      const request: WorkerRequest = { jobId, input: job.input };
      worker.postMessage(request);
    }
  }

  private failJob(jobId: number, error: unknown): void {
    const job = this.jobs.get(jobId);
    if (job === undefined || job.settled) {
      return;
    }
    job.settled = true;
    this.jobs.delete(jobId);
    const queueIndex = this.queuedJobIds.indexOf(jobId);
    if (queueIndex >= 0) {
      this.queuedJobIds.splice(queueIndex, 1);
    }
    job.reject(error);
  }

  private completeJob(jobId: number, document: CanonicalDocument): void {
    const job = this.jobs.get(jobId);
    if (job === undefined || job.settled) {
      return;
    }
    job.settled = true;
    this.jobs.delete(jobId);
    job.resolve(document);
  }

  private onWorkerMessage(worker: Worker, message: WorkerResponse): void {
    this.workerJob.delete(worker);
    this.idleWorkers.push(worker);

    const job = this.jobs.get(message.jobId);
    if (job === undefined || job.settled) {
      this.pumpQueue();
      return;
    }

    if (message.ok) {
      this.completeJob(message.jobId, message.document);
    } else {
      this.failJob(message.jobId, rehydrateWorkerError(message.error));
    }

    this.pumpQueue();
  }

  private onWorkerError(worker: Worker, error: Error): void {
    const jobId = this.workerJob.get(worker);
    this.workerJob.delete(worker);
    this.replaceWorker(worker);

    if (jobId !== undefined) {
      this.failJob(jobId, error);
    }
    this.pumpQueue();
  }

  async terminateForTests(): Promise<void> {
    for (const worker of this.workers) {
      await worker.terminate();
    }
    this.workers.length = 0;
    this.idleWorkers.length = 0;
    this.jobs.clear();
    this.queuedJobIds.length = 0;
    this.workerJob.clear();
  }
}

function getValidationWorkerPool(): ValidationWorkerPool {
  if (pool === undefined) {
    pool = new ValidationWorkerPool(resolveValidationWorkerPoolSize());
  }
  return pool;
}

export async function runValidationOffThread(
  input: ValidateBeforePersistInput
): Promise<CanonicalDocument> {
  if (!isValidationWorkersEnabled() || requiresValidationSync(input.workspaceType)) {
    return validateCanonicalBeforePersistSync(input);
  }
  return getValidationWorkerPool().run(input);
}

/** Test-only — tear down workers between specs. */
export async function resetValidationWorkerPoolForTests(): Promise<void> {
  if (pool !== undefined) {
    await pool.terminateForTests();
    pool = undefined;
  }
}
