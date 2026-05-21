import { TOUR_WORKSPACE_DEFINITIONS } from '../packages/shared-contracts/dist/tours/workspace-registry.js';
// Wait, I can't easily import from dist if it's not built.
// I'll use a simpler approach for the certification tool.

console.log("Starting Workspace Certification...");

for (const [id, ws] of Object.entries(TOUR_WORKSPACE_DEFINITIONS || {})) {
  console.log(`\nCertifying Workspace: ${id}`);
  
  if (!ws.profile) throw new Error(`${id}: Missing profile`);
  if (!ws.roots || ws.roots.length === 0) throw new Error(`${id}: Missing roots`);
  if (!ws.ui || !ws.ui.wizardMode) throw new Error(`${id}: Missing UI wizardMode`);
  if (!ws.validation || !ws.validation.checkCapacity || !ws.validation.checkTripDetails) {
    throw new Error(`${id}: Missing validation logic`);
  }
  if (!ws.lifecycle || !ws.lifecycle.initialStatus || !ws.lifecycle.publishStatus) {
    throw new Error(`${id}: Missing lifecycle contract`);
  }
  
  console.log(`✅ ${id} PASSED`);
}

console.log("\nAll workspaces certified.");
