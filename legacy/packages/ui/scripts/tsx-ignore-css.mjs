/**
 * Register before tsx: `node --import ./tsx-ignore-css.mjs --import tsx <script>`.
 * Used by @tour/ui and apps/web Denali verify scripts.
 */
import { register } from "node:module";

register("./tsx-css-loader-hook.mjs", import.meta.url);
