import { redirect } from "next/navigation";

import { buildRegisterRedirectTarget } from "@/features/auth/operator-login-logic";

/** Admin panel is invite-only — no self-registration UI. */
export default function AuthRegisterPage() {
  redirect(buildRegisterRedirectTarget());
}
