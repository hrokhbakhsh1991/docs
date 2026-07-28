/**
 * Re-export shim — Phase 4y moved create-prefill into `draft/denali-create-prefill`.
 * Keep this path for `@app-tour/workspace-denali/host/ui/chrome/draft-binding` imports.
 */
export {
  applyDenaliTemplateGatePrefill,
  buildDenaliCreatePrefilledForm,
  DENALI_CREATE_PREFILL_PLUGIN_ID,
  type ApplyDenaliTemplatePrefill,
  type DenaliTemplateGatePrefill,
} from "../../draft/denali-create-prefill";
