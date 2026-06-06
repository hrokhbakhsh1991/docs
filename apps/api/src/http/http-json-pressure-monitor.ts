import { metricsRegistry } from "../observability/metrics";

/** Ingress 413 REQUEST_BODY_TOO_LARGE counter — B5 / NN-07 (DEC-052). */
export function recordHttpRequestBodyRejected(): void {
  metricsRegistry.increment("http_request_body_rejected_total");
}

/** Egress 507 RESPONSE_TOO_LARGE counter — B5 / NN-07 (DEC-129). */
export function recordHttpResponseBodyRejected(): void {
  metricsRegistry.increment("http_response_body_rejected_total");
}

export function readHttpRequestBodyRejectedTotal(): number {
  return metricsRegistry.getMetric("http_request_body_rejected_total");
}

export function readHttpResponseBodyRejectedTotal(): number {
  return metricsRegistry.getMetric("http_response_body_rejected_total");
}
