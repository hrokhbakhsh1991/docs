const REGISTRATION_STATUS_FA: Record<string, string> = {
  Pending: "در انتظار",
  Accepted: "پذیرفته",
  AcceptedPaid: "پذیرفته (پرداخت شده)",
  Rejected: "رد شده",
  Cancelled: "لغو شده",
  NoShow: "عدم حضور",
  Refunded: "استرداد",
};

const PAYMENT_STATUS_FA: Record<string, string> = {
  NotPaid: "پرداخت نشده",
  Paid: "پرداخت شده",
  Refunded: "استرداد",
  Failed: "ناموفق",
  Partial: "پرداخت جزئی",
};

export function formatRegistrationStatusFa(status: string): string {
  return REGISTRATION_STATUS_FA[status] ?? status;
}

export function formatPaymentStatusFa(status: string): string {
  return PAYMENT_STATUS_FA[status] ?? status;
}
