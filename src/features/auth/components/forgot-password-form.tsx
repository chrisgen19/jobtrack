"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { fieldAria, FormField, TextInput } from "@/components/shared/form-controls";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth/auth-client";
import { forgotPasswordSchema, type ForgotPasswordValues } from "../schemas";
import { FormAlert } from "./auth-card";

export function ForgotPasswordForm() {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const form = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });
  const { errors, isSubmitting } = form.formState;

  async function onSubmit(values: ForgotPasswordValues) {
    setError(null);
    const { error: requestError } = await authClient.requestPasswordReset({
      email: values.email,
      redirectTo: "/reset-password",
    });
    if (requestError?.status === 429) {
      setError("Too many requests. Please wait a few minutes and try again.");
      return;
    }
    // Same message whether or not the account exists (no user enumeration).
    setSent(true);
  }

  if (sent) {
    return (
      <FormAlert tone="success">
        If an account exists for that email, a password reset link is on its way. The link expires in 1 hour.
      </FormAlert>
    );
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
      {error ? <FormAlert>{error}</FormAlert> : null}
      <FormField id="email" label="Email" error={errors.email?.message}>
        <TextInput
          type="email"
          autoComplete="email"
          {...fieldAria("email", errors.email?.message)}
          {...form.register("email")}
        />
      </FormField>
      <Button type="submit" size="lg" disabled={isSubmitting} className="w-full">
        {isSubmitting ? "Sending..." : "Send reset link"}
      </Button>
    </form>
  );
}
