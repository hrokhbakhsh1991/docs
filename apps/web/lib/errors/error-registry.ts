import { GlobalErrorTaxonomy } from "@repo/shared";

import { ALL_KNOWN_API_ERROR_CODES, DOMAIN_API_ERROR_CODES } from "./canonical-api-error-codes";

export type UIError = {
  title: string;
  message: string;
  action?: "login" | "retry" | "contact_support" | "none";
};

const loginAction = { action: "login" as const };

function titleFromCode(code: string): string {
  const words = code
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
  return words.length > 48 ? "Request Error" : words;
}

function domainDefaultUi(code: string): UIError {
  return {
    title: titleFromCode(code),
    message: "This action could not be completed. Review your input or permissions and try again.",
    action: "none",
  };
}

const CORE_REGISTRY: Record<string, UIError> = {
  [GlobalErrorTaxonomy.AUTH.UNAUTHENTICATED]: {
    title: "Authentication Required",
    message: "Your session has expired. Please log in again.",
    ...loginAction,
  },
  [GlobalErrorTaxonomy.AUTH.SESSION_INVALID]: {
    title: "Invalid Session",
    message: "Your session is no longer valid. Please log in again.",
    ...loginAction,
  },
  [GlobalErrorTaxonomy.AUTH.TOKEN_REVOKED]: {
    title: "Session Ended",
    message: "Your session was revoked. Please sign in again.",
    ...loginAction,
  },
  [GlobalErrorTaxonomy.AUTH.PHONE_INVALID]: {
    title: "Invalid Phone",
    message: "Enter a valid phone number and try again.",
    action: "none",
  },
  [GlobalErrorTaxonomy.AUTH.OTP_INVALID]: {
    title: "Invalid Code",
    message: "The verification code is incorrect. Try again.",
    action: "none",
  },
  [GlobalErrorTaxonomy.AUTH.OTP_EXPIRED]: {
    title: "Code Expired",
    message: "Request a new verification code and try again.",
    action: "retry",
  },
  [GlobalErrorTaxonomy.AUTH.NO_ACTIVE_MEMBERSHIP]: {
    title: "No Workspace Access",
    message: "You do not have an active membership for this workspace.",
    action: "none",
  },
  [GlobalErrorTaxonomy.AUTH.TELEGRAM_CONTEXT_REQUIRED]: {
    title: "Telegram Sign-In Required",
    message: "Open this workspace from the Telegram mini-app to continue.",
    action: "none",
  },
  [GlobalErrorTaxonomy.TENANT.CONTEXT_MISSING]: {
    title: "Workspace Context Lost",
    message: "Workspace context was lost. Refresh the page or sign in again.",
    ...loginAction,
  },
  [GlobalErrorTaxonomy.TENANT.CONTEXT_INVALID]: {
    title: "Invalid Workspace Context",
    message: "Workspace context is invalid. Use your workspace URL and try again.",
    action: "none",
  },
  [GlobalErrorTaxonomy.TENANT.HOST_UNKNOWN]: {
    title: "Workspace Not Found",
    message: "The requested workspace does not exist or you do not have access.",
    action: "none",
  },
  [GlobalErrorTaxonomy.TENANT.SCOPE_FORBIDDEN]: {
    title: "Workspace Access Denied",
    message: "You cannot access this workspace with your current account.",
    action: "none",
  },
  [GlobalErrorTaxonomy.TENANT.HOST_MISMATCH]: {
    title: "Workspace Mismatch",
    message: "This URL does not match your active workspace.",
    action: "none",
  },
  TENANT_HOST_TOKEN_MISMATCH: {
    title: "Wrong Workspace Session",
    message: "Your session belongs to a different workspace. Sign in on the correct URL.",
    ...loginAction,
  },
  TENANT_HOST_RESERVED: {
    title: "Reserved Address",
    message: "This workspace address is reserved and cannot be used.",
    action: "none",
  },
  TENANT_SCOPE_CONFLICT: {
    title: "Workspace Conflict",
    message: "Workspace scope conflicts with your session or host.",
    action: "none",
  },
  [GlobalErrorTaxonomy.RBAC.FORBIDDEN_ABILITY]: {
    title: "Access Denied",
    message: "You do not have permission to perform this action.",
    action: "none",
  },
  [GlobalErrorTaxonomy.RBAC.FORBIDDEN_ROLE]: {
    title: "Role Restricted",
    message: "Your role cannot perform this action.",
    action: "none",
  },
  [GlobalErrorTaxonomy.RBAC.INSUFFICIENT_PRIVILEGE]: {
    title: "Insufficient Privilege",
    message: "Your role does not have enough privilege for this action.",
    action: "none",
  },
  [GlobalErrorTaxonomy.RBAC.SELF_ROLE_CHANGE_FORBIDDEN]: {
    title: "Role Change Blocked",
    message: "You cannot change your own role this way.",
    action: "none",
  },
  RBAC_OWNER_ROLE_ASSIGNMENT_FORBIDDEN: {
    title: "Owner Role Protected",
    message: "The owner role cannot be assigned this way.",
    action: "none",
  },
  RBAC_PROTECTED_ROLE_MODIFICATION_FORBIDDEN: {
    title: "Protected Role",
    message: "This role cannot be modified.",
    action: "none",
  },
  [GlobalErrorTaxonomy.VALIDATION.FAILED]: {
    title: "Invalid Input",
    message: "Please check your input and try again.",
    action: "none",
  },
  [GlobalErrorTaxonomy.VALIDATION.REQUIRED_FIELD_MISSING]: {
    title: "Missing Information",
    message: "Fill in all required fields and try again.",
    action: "none",
  },
  [GlobalErrorTaxonomy.VALIDATION.ENUM_INVALID]: {
    title: "Invalid Option",
    message: "Choose a valid option from the list and try again.",
    action: "none",
  },
  [GlobalErrorTaxonomy.VALIDATION.FIELD_FORMAT_INVALID]: {
    title: "Invalid Format",
    message: "One or more fields use an unsupported format. Check and try again.",
    action: "none",
  },
  [GlobalErrorTaxonomy.RESOURCE.NOT_FOUND]: {
    title: "Not Found",
    message: "The requested item could not be found.",
    action: "none",
  },
  [GlobalErrorTaxonomy.RESOURCE.CONFLICT]: {
    title: "Action Not Allowed",
    message: "This change is not allowed in the current state.",
    action: "none",
  },
  [GlobalErrorTaxonomy.RESOURCE.CONCURRENCY_CONFLICT]: {
    title: "Conflict",
    message: "Someone else updated this record. Refresh and try again.",
    action: "retry",
  },
  [GlobalErrorTaxonomy.RESOURCE.IDEMPOTENCY_REPLAY_MISMATCH]: {
    title: "Duplicate Request",
    message: "This request was already processed with different data.",
    action: "none",
  },
  REGISTRATION_DUPLICATE_ACTIVE: {
    title: "Already Registered",
    message: "You already have an active registration for this tour.",
    action: "none",
  },
  REGISTRATION_ROW_VERSION_CONFLICT: {
    title: "Registration Updated Elsewhere",
    message: "Refresh and retry your registration change.",
    action: "retry",
  },
  CAPACITY_FULL: {
    title: "Tour Full",
    message: "This tour has reached capacity.",
    action: "none",
  },
  WAITLIST_CONFLICT_ACTIVE_RECORD: {
    title: "Waitlist Conflict",
    message: "You already have an active waitlist entry for this tour.",
    action: "none",
  },
  TOUR_NOT_PUBLISHABLE: {
    title: "Cannot Publish",
    message: "Complete required tour fields before publishing.",
    action: "none",
  },
  TOUR_NOT_OPEN: {
    title: "Tour Not Open",
    message: "This tour is not open for registration.",
    action: "none",
  },
  TOUR_PATCH_FIELD_FORBIDDEN: {
    title: "Field Not Editable",
    message: "You cannot change this field in the current tour state.",
    action: "none",
  },
  PAYMENT_STATUS_TRANSITION_INVALID: {
    title: "Payment State Error",
    message: "This payment cannot move to the requested state.",
    action: "contact_support",
  },
  INVALID_LIFECYCLE_TRANSITION: {
    title: "Status Change Not Allowed",
    message: "This status change is not valid for the current record.",
    action: "none",
  },
  USER_NOT_FOUND: {
    title: "User Not Found",
    message: "The user could not be found in this workspace.",
    action: "none",
  },
  USER_EMAIL_CONFLICT: {
    title: "Email In Use",
    message: "Another user already uses this email address.",
    action: "none",
  },
  USER_PHONE_CONFLICT: {
    title: "Phone In Use",
    message: "Another user already uses this phone number.",
    action: "none",
  },
  USER_NATIONAL_ID_CONFLICT: {
    title: "National ID In Use",
    message: "Another user already uses this national ID.",
    action: "none",
  },
  USER_NATIONAL_ID_INVALID: {
    title: "Invalid National ID",
    message: "Enter a valid national ID and try again.",
    action: "none",
  },
  USER_BIRTH_DATE_INVALID: {
    title: "Invalid Birth Date",
    message: "Enter a valid birth date and try again.",
    action: "none",
  },
  EMAIL_VERIFICATION_INVALID: {
    title: "Verification Failed",
    message: "This email verification link is invalid or expired.",
    action: "none",
  },
  USER_PHONE_UNCHANGED: {
    title: "Phone Unchanged",
    message: "The new phone number matches the current one.",
    action: "none",
  },
  MOBILE_OTP_INVALID_PURPOSE: {
    title: "OTP Not Allowed",
    message: "This verification flow is not allowed for your account.",
    action: "none",
  },
  EXPORT_SNAPSHOT_INCONSISTENT: {
    title: "Export Unavailable",
    message: "Export data is inconsistent. Refresh and try again.",
    action: "retry",
  },
  PROFILE_ROW_VERSION_CONFLICT: {
    title: "Profile Updated Elsewhere",
    message: "Someone else updated this profile. Refresh and try again.",
    action: "retry",
  },
  WEBHOOK_SIGNATURE_INVALID: {
    title: "Webhook Rejected",
    message: "The webhook signature could not be verified.",
    action: "none",
  },
  WEBHOOK_TIMESTAMP_INVALID: {
    title: "Webhook Rejected",
    message: "The webhook timestamp is invalid.",
    action: "none",
  },
  WEBHOOK_TIMESTAMP_EXPIRED: {
    title: "Webhook Expired",
    message: "The webhook event is too old to process.",
    action: "none",
  },
  WEBHOOK_IP_NOT_ALLOWED: {
    title: "Webhook Blocked",
    message: "This webhook origin is not allowed.",
    action: "none",
  },
  RBAC_UNKNOWN_MEMBERSHIP_ROLE: {
    title: "Unknown Role",
    message: "This membership role is not recognized. Contact your administrator.",
    action: "contact_support",
  },
  INVITE_NOT_FOUND: {
    title: "Invite Not Found",
    message: "This invitation link is invalid.",
    action: "none",
  },
  INVITE_EXPIRED: {
    title: "Invite Expired",
    message: "This invitation has expired. Request a new invite.",
    action: "none",
  },
  INVITE_EMAIL_MISMATCH: {
    title: "Invite Mismatch",
    message: "This invite does not match your account email.",
    action: "none",
  },
  VALIDATION_UNKNOWN_FIELD: {
    title: "Unknown Field",
    message: "The request included a field that is not allowed.",
    action: "none",
  },
  OPS_UNAUTHORIZED: {
    title: "Unauthorized",
    message: "This operation requires internal authorization.",
    action: "none",
  },
  [GlobalErrorTaxonomy.SYSTEM.RATE_LIMITED]: {
    title: "Too Many Requests",
    message: "Please wait a moment and try again.",
    action: "retry",
  },
  [GlobalErrorTaxonomy.SYSTEM.BACKEND_UNREACHABLE]: {
    title: "System Unavailable",
    message: "We're having trouble connecting to our servers. Please try again later.",
    action: "retry",
  },
  [GlobalErrorTaxonomy.SYSTEM.DEPENDENCY_UNAVAILABLE]: {
    title: "Service Temporarily Unavailable",
    message: "A dependency is temporarily unavailable. Try again shortly.",
    action: "retry",
  },
  [GlobalErrorTaxonomy.SYSTEM.SCHEMA_DRIFT]: {
    title: "System Maintenance Required",
    message: "The application schema is out of date. Contact your administrator.",
    action: "contact_support",
  },
  SCHEMA_DRIFT_MISSING_COLUMN: {
    title: "Database Schema Out of Date",
    message: "Run API migrations against the database, then retry.",
    action: "contact_support",
  },
  SCHEMA_DRIFT_MISSING_TABLE: {
    title: "Database Schema Out of Date",
    message: "Run API migrations against the database, then retry.",
    action: "contact_support",
  },
  [GlobalErrorTaxonomy.SYSTEM.INTERNAL_ERROR]: {
    title: "Unexpected Error",
    message: "Something went wrong on our end. Our team has been notified.",
    action: "contact_support",
  },
};

const DOMAIN_REGISTRY = Object.fromEntries(
  DOMAIN_API_ERROR_CODES.filter((code) => !(code in CORE_REGISTRY)).map((code) => [
    code,
    domainDefaultUi(code),
  ]),
) as Record<string, UIError>;

export const ErrorRegistry: Record<string, UIError> = {
  ...DOMAIN_REGISTRY,
  ...CORE_REGISTRY,
};

export function getUIError(code: string): UIError {
  const hit = ErrorRegistry[code];
  if (hit) {
    return hit;
  }
  if (ALL_KNOWN_API_ERROR_CODES.includes(code)) {
    return domainDefaultUi(code);
  }
  return {
    title: "Error",
    message: "An unexpected error occurred.",
    action: "none",
  };
}

export function registryCoverageRatio(): { mapped: number; total: number } {
  const total = ALL_KNOWN_API_ERROR_CODES.length;
  const mapped = ALL_KNOWN_API_ERROR_CODES.filter((c) => c in ErrorRegistry).length;
  return { mapped, total };
}
