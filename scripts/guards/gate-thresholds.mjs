/**
 * Single source of truth for enforced test-count floors in phase gates.
 * Import from guard scripts — do not duplicate MIN_* literals elsewhere.
 */

/** @type {Readonly<Record<string, number>>} */
export const WORKSPACE_SDK_TEST_MIN = {
  /** Retired from gates (H-03/H-13) — informational only if referenced */
  phase0: 103,
  /** phase-1-guard g2b — regression floor after Phase 0 adversarial suite */
  phase1: 39,
  /** phase-2-guard — theme ingress + CASL growth */
  phase2: 50,
  /** phase-3-guard — full scaffold close */
  phase3: 100,
};

export const PLATFORM_CORE_TEST_MIN = {
  phase1: 132,
};

/** phase-1-guard g2 — closure suite only (excludes test/unit/**) */
export const PLATFORM_CORE_CLOSURE_TEST_MIN = {
  phase1: 50,
};

/** phase-1-guard g13 — facade-path share within closure specs (excludes test/unit/**) */
export const PHASE_1_FACADE_TEST_RATIO_MIN = 0.6;

export const UI_PRIMITIVES_TEST_MIN = {
  phase2: 12,
};

export const THEME_REACT_TEST_MIN = {
  phase2: 4,
};

export const WORKSPACE_STARTER_TEST_MIN = {
  phase3: 15,
};

export const APPS_API_TEST_MIN = {
  phase3: 20,
};

export const APPS_WEB_TEST_MIN = {
  phase3: 10,
};

export const UI_PRIMITIVES_VISUAL_TEST_MIN = {
  phase2: 4,
};
