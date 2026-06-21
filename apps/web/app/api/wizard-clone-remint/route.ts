import { proxyWizardCloneRemintPost } from "@/wizard/proxy-wizard-clone-remint.server";

/** Phase 14.1 — neutral wizard clone remint BFF. */
export async function POST(req: Request) {
  return proxyWizardCloneRemintPost(req);
}
