import { z } from "zod";

/** Shared with tests; `t` is `useTranslations("auth")`. */
export function buildRegisterFormSchema(tAuth: (_key: string) => string) {
  return z.object({
    name: z.string().trim().min(1, tAuth("register.validationNameRequired")),
    email: z.union([
      z.literal(""),
      z.string().trim().email({ message: tAuth("register.validationEmailInvalid") }),
    ]),
  });
}

export type RegisterFormValues = z.infer<ReturnType<typeof buildRegisterFormSchema>>;
