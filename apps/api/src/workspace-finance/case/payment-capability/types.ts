/**
 * Host-owned payment capability mode (PR10-B).
 * finance-core must never import this module or learn paymentMode.
 */

export type PaymentCapabilityMode = "manual" | "online";
