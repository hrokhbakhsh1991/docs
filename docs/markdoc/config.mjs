/**
 * Markdoc schema for docs-as-code audits (§19 MIGRATION-MAP).
 * @type {import('@markdoc/markdoc').Config}
 */
import tags from "./schema/tags.mjs";

export default {
  tags,
  variables: {
    repo: "app-tour",
  },
};
