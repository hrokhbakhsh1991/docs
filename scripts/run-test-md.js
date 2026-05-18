#!/usr/bin/env node
/**
 * Utility to read TEST.MD, execute JavaScript code blocks, and generate TEST-REPORT.MD.
 *
 * Steps:
 * 1. Read TEST.MD from the repository root.
 * 2. Find fenced JavaScript code blocks (```js or ```javascript).
 * 3. Execute each block in a sandboxed VM, capturing console output.
 * 4. Write a report file that includes the original markdown and an
 *    "## Execution Report" section with the results of each block.
 *
 * Usage:
 *   node scripts/run-test-md.js
 *
 * Note:
 *   - Only JavaScript blocks are executed for safety.
 *   - Execution is limited to 5 seconds per block.
 *   - Errors are captured and displayed in the report.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

// Resolve paths relative to the repository root
const REPO_ROOT = path.resolve(__dirname, '..');
const INPUT_PATH = path.join(REPO_ROOT, 'TEST.MD');
const OUTPUT_PATH = path.join(REPO_ROOT, 'test-report.md');

/**
 * Read a file synchronously, exiting on failure.
 * @param {string} filePath
 * @returns {string}
 */
function readFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    console.error(`Failed to read ${filePath}: ${err.message}`);
    process.exit(1);
  }
}

/**
 * Write the final report, exiting on failure.
 * @param {string} content
 */
function writeReport(content) {
  try {
    fs.writeFileSync(OUTPUT_PATH, content, 'utf8');
    console.log(`Report written to ${OUTPUT_PATH}`);
  } catch (err) {
    console.error(`Failed to write report: ${err.message}`);
    process.exit(1);
  }
}

/**
 * Extract JavaScript code blocks from markdown.
 * Supports ```js and ```javascript fences.
 * @param {string} markdown
 * @returns {string[]} array of code strings
 */
function extractJsBlocks(markdown) {
  const regex = /```(?:js|javascript)\s*\n([\s\S]*?)```/gi;
  const blocks = [];
  let match;
  while ((match = regex.exec(markdown)) !== null) {
    blocks.push(match[1]);
  }
  return blocks;
}

/**
 * Execute a single JavaScript block in a sandbox.
 * Captures console.log / console.error output.
 * @param {string} code
 * @returns {{ success: boolean, output?: string, error?: string }}
 */
function executeBlock(code) {
  const sandbox = {
    console: {
      log: (...args) => sandbox._out.push(args.join(' ')),
      error: (...args) => sandbox._out.push(args.join(' ')),
    },
    require,
    module,
    exports,
    process,
    setTimeout,
    setInterval,
    clearTimeout,
    clearInterval,
    _out: [],
  };
  const context = vm.createContext(sandbox);
  try {
    const script = new vm.Script(code, { timeout: 5000 });
    script.runInContext(context);
    return { success: true, output: sandbox._out.join('\n') };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Main execution flow.
 */
function main() {
  const markdown = readFile(INPUT_PATH);
  const jsBlocks = extractJsBlocks(markdown);

  let report = `${markdown}\n\n## Execution Report\n`;

  if (jsBlocks.length === 0) {
    report += '_No JavaScript code blocks found in TEST.MD._\n';
    writeReport(report);
    return;
  }

  jsBlocks.forEach((code, idx) => {
    report += `\n### Block ${idx + 1}\n`;
    const result = executeBlock(code);
    if (result.success) {
      report += `**Output:**\n\`\`\`\n${result.output}\n\`\`\`\n`;
    } else {
      report += `**Error:**\n\`\`\`\n${result.error}\n\`\`\`\n`;
    }
  });

  writeReport(report);
}

main();
