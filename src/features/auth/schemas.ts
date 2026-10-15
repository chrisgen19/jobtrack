import { z } from "zod";

export const PASSWORD_MIN = 10;

const password = z
  .string()
  .min(PASSWORD_MIN, { error: `Use at least ${PASSWORD_MIN} characters.` })
  .max(128, { error: "Use at most 128 characters." });

export const loginSchema = z.object({
  email: z.email({ error: "Enter a valid email." }),
  password: z.string().min(1, { error: "Enter your password." }),
  rememberMe: z.boolean(),
});

export const registerSchema = z
  .object({
    name: z.string().trim().min(1, { error: "Enter your name." }).max(80),
    email: z.email({ error: "Enter a valid email." }),
    password,
    confirmPassword: z.string(),
  })
  .refine((values) => values.password === values.confirmPassword, {
    error: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export const forgotPasswordSchema = z.object({
  email: z.email({ error: "Enter a valid email." }),
});

export const resetPasswordSchema = z
  .object({ password, confirmPassword: z.string() })
  .refine((values) => values.password === values.confirmPassword, {
    error: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export type LoginValues = z.infer<typeof loginSchema>;
export type RegisterValues = z.infer<typeof registerSchema>;
export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;

/** Only allow same-origin relative redirects ("/jobs"), never "//evil.com". */
export function safeRedirectPath(value: string | null | undefined, fallback = "/dashboard"): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  return value;
}
