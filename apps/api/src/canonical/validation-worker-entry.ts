import { parentPort } from "node:worker_threads";

import { validateCanonicalBeforePersistSync } from "../tours/canonical-validation";
import type { ValidateBeforePersistInput } from "../tours/canonical-validation";

type WorkerRequest = {
  readonly jobId: number;
  readonly input: ValidateBeforePersistInput;
};

type WorkerSuccess = {
  readonly jobId: number;
  readonly ok: true;
  readonly document: unknown;
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

function serializeError(error: unknown): WorkerFailure["error"] {
  if (error instanceof Error) {
    const code =
      "code" in error && typeof (error as { code?: unknown }).code === "string"
        ? (error as { code: string }).code
        : undefined;
    return { name: error.name, message: error.message, code };
  }
  return { name: "Error", message: String(error) };
}

parentPort?.on("message", (message: WorkerRequest) => {
  try {
    const document = validateCanonicalBeforePersistSync(message.input);
    const response: WorkerSuccess = { jobId: message.jobId, ok: true, document };
    parentPort?.postMessage(response);
  } catch (error) {
    const response: WorkerFailure = {
      jobId: message.jobId,
      ok: false,
      error: serializeError(error),
    };
    parentPort?.postMessage(response);
  }
});
