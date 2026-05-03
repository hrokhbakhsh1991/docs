import type { Metadata } from "next";

import { LoginForm } from "../auth/login/login-form";

export const metadata: Metadata = {
  title: "Login",
  description: "Standalone web sign-in — TourOps workspace.",
};

export default function LoginPage() {
  return <LoginForm />;
}
