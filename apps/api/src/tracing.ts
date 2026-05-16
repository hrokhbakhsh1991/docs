/**
 * OpenTelemetry SDK bootstrap — MUST load before Nest/Express (`import "./tracing"` first in `main.ts`).
 * Uses standard OTEL env vars; disabled in `NODE_ENV=test` unless `OTEL_ENABLE_IN_TEST=true`.
 */
import type { Context } from "@opentelemetry/api";
import { ExportResultCode } from "@opentelemetry/core";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import {
  BatchSpanProcessor,
  type ReadableSpan,
  type Span,
  type SpanExporter,
  type SpanProcessor
} from "@opentelemetry/sdk-trace-base";
import { Resource } from "@opentelemetry/resources";
import { requestContextStorage } from "./common/request-context/request-context";

function shouldEnableTracing(): boolean {
  if (process.env.OTEL_SDK_DISABLED === "true" || process.env.OTEL_SDK_DISABLED === "1") {
    return false;
  }
  if (process.env.NODE_ENV === "test" && process.env.OTEL_ENABLE_IN_TEST !== "true") {
    return false;
  }
  return true;
}

/** Drops spans cheaply when no OTLP endpoint is configured (avoids growing buffers). */
class VoidSpanExporter implements SpanExporter {
  export(_spans: ReadableSpan[], done: (result: { code: ExportResultCode }) => void): void {
    done({ code: ExportResultCode.SUCCESS });
  }

  async shutdown(): Promise<void> {
    /* noop */
  }
}

/**
 * Injects SaaS context onto every span started while {@link requestContextStorage} is active
 * (HTTP handlers, DB calls under the same async continuation).
 */
function spanDurationMs(span: ReadableSpan): number {
  const [seconds, nanoseconds] = span.duration;
  return seconds * 1_000 + nanoseconds / 1_000_000;
}

function isDatabaseSpan(span: ReadableSpan): boolean {
  if (span.attributes["db.system"] !== undefined) {
    return true;
  }
  const name = span.name.toLowerCase();
  return name.includes("pg.") || name.includes("postgres") || name.includes("typeorm");
}

class RequestContextSpanProcessor implements SpanProcessor {
  onStart(span: Span, _parentContext: Context): void {
    const store = requestContextStorage.getStore();
    if (!store) {
      return;
    }
    span.setAttribute("request_id", store.requestId);
    const correlationId = store.correlationId?.trim() || store.requestId;
    span.setAttribute("correlation_id", correlationId);
    if (store.traceparent !== undefined && store.traceparent !== "") {
      span.setAttribute("traceparent", store.traceparent);
    }
    if (store.path !== undefined && store.path !== "") {
      span.setAttribute("route", store.path);
    }
    const tenantId = store.tenantId ?? store.hostTenantId;
    if (tenantId !== undefined && tenantId !== "") {
      span.setAttribute("tenant_id", tenantId);
    }
    if (store.userId !== undefined && store.userId !== "") {
      span.setAttribute("user_id", store.userId);
    }
  }

  onEnd(span: ReadableSpan): void {
    if (!isDatabaseSpan(span)) {
      return;
    }
    const store = requestContextStorage.getStore();
    if (!store) {
      return;
    }
    store.dbDurationMs = (store.dbDurationMs ?? 0) + spanDurationMs(span);
    store.dbSpanCount = (store.dbSpanCount ?? 0) + 1;
  }

  async shutdown(): Promise<void> {}

  async forceFlush(): Promise<void> {}
}

function normalizeOtlpTracesUrl(endpoint: string): string {
  const trimmed = endpoint.trim().replace(/\/$/, "");
  if (trimmed.endsWith("/v1/traces")) {
    return trimmed;
  }
  return `${trimmed}/v1/traces`;
}

function resolveOtlpTracesUrl(): string | undefined {
  const traces = process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT?.trim();
  if (traces) {
    return normalizeOtlpTracesUrl(traces);
  }
  const base = process.env.OTEL_EXPORTER_OTLP_ENDPOINT?.trim();
  if (base) {
    return normalizeOtlpTracesUrl(base);
  }
  return undefined;
}

let sdk: NodeSDK | undefined;

export function startTracing(): void {
  if (!shouldEnableTracing()) {
    return;
  }
  if (sdk) {
    return;
  }

  const serviceName = process.env.OTEL_SERVICE_NAME?.trim() || "tour-ops-api";
  const processors: SpanProcessor[] = [new RequestContextSpanProcessor()];

  const otlpUrl = resolveOtlpTracesUrl();
  const exporter: SpanExporter = otlpUrl
    ? new OTLPTraceExporter({ url: otlpUrl })
    : new VoidSpanExporter();

  processors.push(new BatchSpanProcessor(exporter));

  sdk = new NodeSDK({
    resource: new Resource({
      "service.name": serviceName,
      "service.version": process.env.npm_package_version ?? "0.1.0"
    }),
    spanProcessors: processors,
    instrumentations: [
      getNodeAutoInstrumentations({
        "@opentelemetry/instrumentation-fs": { enabled: false }
      })
    ]
  });

  sdk.start();
}

export async function shutdownTracing(): Promise<void> {
  if (!sdk) {
    return;
  }
  try {
    await sdk.shutdown();
  } finally {
    sdk = undefined;
  }
}
