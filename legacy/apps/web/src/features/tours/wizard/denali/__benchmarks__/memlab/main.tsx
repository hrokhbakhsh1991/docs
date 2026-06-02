import React from "react";
import { createRoot } from "react-dom/client";

import { WizardMemlabHarness } from "./WizardMemlabHarness";

const rootEl = document.getElementById("root");
if (rootEl == null) {
  throw new Error("memlab harness: missing #root");
}

createRoot(rootEl).render(
  <React.StrictMode>
    <WizardMemlabHarness />
  </React.StrictMode>,
);
