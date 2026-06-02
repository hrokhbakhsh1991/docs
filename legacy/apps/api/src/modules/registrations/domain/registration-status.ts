export enum RegistrationStatus {
  PENDING = "Pending",
  ACCEPTED = "Accepted",
  ACCEPTED_PAID = "AcceptedPaid",
  REJECTED = "Rejected",
  CANCELLED = "Cancelled",
  NO_SHOW = "NoShow",
  REFUNDED = "Refunded",
}

export enum RegistrationPaymentStatus {
  NOT_PAID = "NotPaid",
  PAID = "Paid",
  REFUNDED = "Refunded",
  FAILED = "Failed",
  PARTIAL = "Partial",
}
