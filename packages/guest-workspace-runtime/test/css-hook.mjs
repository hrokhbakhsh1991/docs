import { register } from "node:module";
import { createRequire } from "node:module";

register("./css-hook-loader.mjs", import.meta.url);

const require = createRequire(import.meta.url);
require.extensions[".css"] = (module) => {
  module.exports = {};
};
