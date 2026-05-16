#!/usr/bin/env node
/**
 * Phase 4.5 — documents how to capture a Node heap profile for Next middleware / lookup hot paths.
 * Does not run the server; prints copy-paste commands for local investigation.
 */
const steps = `
# Middleware / workspace lookup heap profile (manual)

1. Build and start web standalone with Node diagnostics:
   cd apps/web && pnpm run build
   NODE_OPTIONS='--heap-prof' node .next/standalone/apps/web/server.js

2. Generate probe traffic (another terminal):
   node scripts/load-multi-tenant-probe.mjs
   # or repeated unknown-host probes:
   for i in $(seq 1 200); do
     curl -s -o /dev/null -w "%{http_code}\\n" \\
       -H "Host: probe-\${i}-x.localhost:3000" \\
       http://127.0.0.1:3000/login || true
   done

3. Stop the server (Ctrl+C). Node writes \`Heap.*.heapprofile\` in cwd.

4. Open in Chrome DevTools → Memory → Load profile, or:
   node --prof-process isolate-*.log  # if using --prof instead

See also: node scripts/bench-tenant-resolve.mjs
`;

console.log(steps.trim());
