import { Injectable } from "@nestjs/common";
import { SpanStatusCode, context, trace } from "@opentelemetry/api";

/**
 * Manual spans for domain operations (services). Auto-instrumentation covers HTTP and `pg`;
 * use this for explicit business spans that must appear in Jaeger/Tempo/Datadog.
 */
@Injectable()
export class TracingService {
  private readonly tracer = trace.getTracer("tour-ops-api");

  /**
   * Runs `fn` inside an active child span; ends the span with OK/ERROR and propagates context to awaits.
   */
  async withSpan<T>(
    name: string,
    fn: () => Promise<T>,
    attributes?: Record<string, string | number | boolean>
  ): Promise<T> {
    return await this.tracer.startActiveSpan(name, { attributes }, async (span) => {
      try {
        const result = await fn();
        span.setStatus({ code: SpanStatusCode.OK });
        return result;
      } catch (err) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: err instanceof Error ? err.message : String(err)
        });
        span.recordException(err instanceof Error ? err : new Error(String(err)));
        throw err;
      } finally {
        span.end();
      }
    });
  }

  /** Manual span; caller must end the span. */
  startSpan(name: string, attributes?: Record<string, string | number | boolean>) {
    return this.tracer.startSpan(name, { attributes }, context.active());
  }
}
