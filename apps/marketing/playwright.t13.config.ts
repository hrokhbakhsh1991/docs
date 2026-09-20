import baseConfig from "./playwright.marketing.config";

export default {
  ...baseConfig,
  testMatch: ["t13-surface-browser-proof.spec.ts"],
};
