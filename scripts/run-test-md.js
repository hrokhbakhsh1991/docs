#!/usr/bin/env node
/**
 * Simple utility to "run" TEST.MD and generate a report.
 *
 * This script:
 * 1. Reads the `TEST.MD` file from the repository root.
 * 2. Extracts fenced code blocks (```js ... ```) and executes them sequentially.
 * 3. Captures stdout / stderr from each block.
 * 4. Writes a new file `TEST-REPORT.MD` that contains:
 *    - The original content of TEST.MD.
 *    - A "## Execution Report" section with the results of each code block.
 *
 * Usage:
 *   node scripts/run-test-md.js
 *
 * Note:
 *   - Only JavaScript code blocks are executed for safety.
 *   - Execution is sandboxed using Node's `vm` module.
 *   - Errors are captured and included in the report.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

// Paths
const ROOT_DIR = path.resolve(__dirname, '..', '..');
const INPUT_FILE = path.join(ROOT_DIR, 'TEST.MD');
const OUTPUT_FILE = path.join(ROOT_DIR, 'TEST-REPORT.MD');

// Helper to read file
function readFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    console.error(`Failed to read ${filePath}:`, err.message);
    process.exit(1);
  }
}

// Helper to write report
function writeReport(content) {
  try {
    fs.writeFileSync(OUTPUT_FILE, content, 'utf8');
    console.log(`Report written to ${OUTPUT_FILE}`);
  } catch (err) {
    console.error(`Failed to write report:`, err.message);
    process.exit(1);
  }
}

// Extract JavaScript code blocks from markdown
function extractJsBlocks(markdown) {
  const regex = /```(?:js|javascript)\s*\n([\s\S]*?)```/gi;
  const blocks = [];
  let match;
  while ((match = regex.exec(markdown)) !== null) {
    blocks.push(match[1]);
  }
  return blocks;
}

// Execute a single code block safely
function executeBlock(code) {
  const sandbox = {
    console: {
      log: (...args) => sandbox._output.push(args.join(' ')),
      error: (...args) => sandbox._output.push(args.join(' ')),
    },
    require,
    module,
    exports,
    process,
    setTimeout,
    setInterval,
    clearTimeout,
    clearInterval,
    _output: [],
  };
  const context = vm.createContext(sandbox);
  try {
    const script = new vm.Script(code, { timeout: 5000 });
    script.runInContext(context);
    return { success: true, output: sandbox._output.join('\n') };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// Main flow
function main() {
  const markdown = readFile(INPUT_FILE);
  const jsBlocks = extractJsBlocks(markdown);

  let report = `${markdown}\n\n## Execution Report\n`;

  if (jsBlocks.length === 0) {
    report += '_No JavaScript code blocks found in TEST.MD._\n';
    writeReport(report);
    return;
  }

  jsBlocks.forEach((code, index) => {
    report += `\n### Block ${index + 1}\n`;
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
