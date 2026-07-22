/**
 * Urban `./plugin` contract façade — allowlisted symbols only.
 * Implementation lives in `internal.ts` (Wave D.b).
 * @see docs/dev/wave-d-urban-plugin-surface.mdoc
 */
export {
  URBAN_THEME_TOKENS_STYLESHEET,
  URBAN_WORKSPACE_PLUGIN_ID,
  URBAN_WORKSPACE_TYPE,
  createUrbanWorkspacePlugin,
  getUrbanWorkspacePlugin,
} from "./internal";
