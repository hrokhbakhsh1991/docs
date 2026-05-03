/**
 * Shared ESLint baseline for packages that opt in via `extends` / spread.
 * App-specific configs live next to each package (e.g. `apps/web/.eslintrc.json`).
 */
module.exports = {
  root: false,
  env: {
    es2022: true,
  },
};
