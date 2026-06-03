import React from "react";

/**
 * CASL deny surface — must not render wizard fields or plugin chrome (Phase 3.3 deny-by-default).
 */
export function WizardAccessDenied() {
  return (
    <div
      role="alert"
      data-workspace-wizard-forbidden
      data-status-code="403"
      aria-live="assertive"
    >
      <h2>Access denied</h2>
      <p>You do not have permission to load this workspace wizard.</p>
    </div>
  );
}
