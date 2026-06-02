export function tenantContextMissingError() {
  return {
    error: {
      code: "TENANT_CONTEXT_MISSING",
      message: "Trusted tenant context required but absent"
    }
  } as const;
}

export function tenantScopedResourceNotFoundError() {
  return {
    error: {
      code: "RESOURCE_NOT_FOUND",
      message: "Resource not found in tenant scope"
    }
  } as const;
}

export function authRequiredError() {
  return {
    error: {
      code: "AUTH_UNAUTHENTICATED",
      message: "Authentication required"
    }
  } as const;
}

