import type { Metadata } from "next";

import { RegisterForm } from "./register-form";

export const metadata: Metadata = {
  title: "Register",
  description: "Create a TourOps workspace account.",
};

export default function AuthRegisterPage() {
  return <RegisterForm />;
}
