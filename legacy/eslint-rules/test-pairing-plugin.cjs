/**
 * ESLint plugin: Test-Pairing governance for features/ and services/ trees.
 */
const path = require("node:path");
const {
  isSubjectFile,
  hasTestPair,
  formatTestPairMessage,
} = require("../scripts/test-pairing-core.mjs");

/** @type {import('eslint').ESLint.Plugin} */
module.exports = {
  rules: {
    "require-test-pair": {
      meta: {
        type: "problem",
        docs: {
          description:
            "Require a co-located .spec/.test file (or __tests__ sibling) under features/ or services/",
        },
        schema: [],
        messages: {
          missing: "{{message}}",
        },
      },
      create(context) {
        const filename = context.getFilename();
        if (!filename || filename === "<input>" || filename.includes("node_modules")) {
          return {};
        }

        const cwd = context.getCwd?.() ?? process.cwd();
        const rel = path.relative(cwd, filename).replace(/\\/g, "/");
        if (!isSubjectFile(rel)) return {};

        if (hasTestPair(filename)) return {};

        return {
          Program(node) {
            context.report({
              node,
              messageId: "missing",
              data: { message: formatTestPairMessage(rel) },
            });
          },
        };
      },
    },
  },
};
