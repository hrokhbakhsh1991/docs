import { NextResponse } from "next/server";
import { GlobalErrorTaxonomy } from "@repo/shared";
import { AppError } from "@/lib/errors/app-error";
import { TenantResolutionError } from "@/lib/tenant/runtime-tenant-context";

function normalizeBffErrorCode(code: string): string {
  switch (code) {
    case "TENANT_RESOLUTION_FAILED":
      return GlobalErrorTaxonomy.TENANT.HOST_UNKNOWN;
    case "TENANT_HOST_UNKNOWN":
    case "TENANT_HOST_TOKEN_MISMATCH":
      return code;
    case "RBAC_FORBIDDEN":
    case "CAPABILITY_DENIED":
      return GlobalErrorTaxonomy.RBAC.FORBIDDEN_ABILITY;
    case "AUTH_SESSION_INVALID":
      return GlobalErrorTaxonomy.AUTH.SESSION_INVALID;
    case "API_UPSTREAM_FAILED":
    case "BACKEND_UNREACHABLE":
      return GlobalErrorTaxonomy.SYSTEM.BACKEND_UNREACHABLE;
    case "INVALID_INPUT":
      return GlobalErrorTaxonomy.VALIDATION.FAILED;
    default:
      return code;
  }
}

function statusForAppError(code: string): number {
  const normalized = normalizeBffErrorCode(code);
  switch (normalized) {
    case GlobalErrorTaxonomy.TENANT.HOST_UNKNOWN:
    case GlobalErrorTaxonomy.TENANT.SCOPE_FORBIDDEN:
      return 403;
    case GlobalErrorTaxonomy.TENANT.HOST_MISMATCH:
    case "TENANT_HOST_TOKEN_MISMATCH":
      return 403;
    case GlobalErrorTaxonomy.AUTH.UNAUTHENTICATED:
    case GlobalErrorTaxonomy.AUTH.SESSION_INVALID:
    case GlobalErrorTaxonomy.AUTH.TOKEN_REVOKED:
      return 401;
    case GlobalErrorTaxonomy.RBAC.FORBIDDEN_ABILITY:
    case GlobalErrorTaxonomy.RBAC.FORBIDDEN_ROLE:
      return 403;
    case GlobalErrorTaxonomy.VALIDATION.FAILED:
      return 400;
    case GlobalErrorTaxonomy.SYSTEM.RATE_LIMITED:
      return 429;
    case GlobalErrorTaxonomy.RESOURCE.NOT_FOUND:
      return 404;
    case GlobalErrorTaxonomy.SYSTEM.BACKEND_UNREACHABLE:
      return 502;
    default:
      return 502;
  }
}

/** Maps BFF guard failures to JSON responses (e.g. TENANT_HOST_UNKNOWN → 403). */
export function bffGuardErrorResponse(
  error: unknown,
  requestId?: string,
): NextResponse | null {
  if (error instanceof TenantResolutionError) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: GlobalErrorTaxonomy.TENANT.HOST_UNKNOWN,
          message: error.message,
          ...(requestId ? { requestId } : {}),
        },
      },
      { status: statusForAppError(GlobalErrorTaxonomy.TENANT.HOST_UNKNOWN) },
    );
  }
  if (!(error instanceof AppError)) {
    return null;
  }
  const code = normalizeBffErrorCode(error.code);
  return NextResponse.json(
    {
      ok: false,
      error: {
        code,
        message: error.message,
        ...(requestId ? { requestId } : {}),
        ...error.context,
      },
    },
    { status: statusForAppError(code) },
  );
}
