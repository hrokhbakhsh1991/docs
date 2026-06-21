import { proxyWizardCloneRemintPost } from "@/wizard/proxy-wizard-clone-remint.server";

/** Legacy alias — prefer `/api/wizard-clone-remint` (Phase 14.1). */
export async function POST(req: Request) {
  return proxyWizardCloneRemintPost(req);
}
