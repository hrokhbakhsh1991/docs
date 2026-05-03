import type { Metadata } from "next";

import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Login",
  description: "Standalone web sign-in — TourOps workspace.",
};

export default function AuthLoginPage() {
  return <LoginForm />;
}
