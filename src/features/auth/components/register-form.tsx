"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { fieldAria, FormField, TextInput } from "@/components/shared/form-controls";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth/auth-client";
import { PASSWORD_MIN, registerSchema, type RegisterValues } from "../schemas";
import { FormAlert } from "./auth-card";

export function RegisterForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: "", email: "", password: "", confirmPassword: "" },
  });
  const { errors, isSubmitting } = form.formState;

  async function onSubmit(values: RegisterValues) {
    setError(null);
    const { data, error: signUpError } = await authClient.signUp.email({
      name: values.name,
      email: values.email,
      password: values.password,
      callbackURL: "/dashboard",
    });
    if (signUpError) {
      setError(
        signUpError.status === 429
          ? "Too many attempts. Please wait a minute and try again."
          : (signUpError.message ?? "We could not create your account. Please try again."),
      );
      return;
    }
    // With email verification required there is no session yet.
    if (data && "token" in data && data.token) {
      router.replace("/onboarding");
      router.refresh();
    } else {
      router.replace(`/verify-email?email=${encodeURIComponent(values.email)}`);
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
      {error ? <FormAlert>{error}</FormAlert> : null}
      <FormField id="name" label="Full name" error={errors.name?.message}>
        <TextInput
          autoComplete="name"
          {...fieldAria("name", errors.name?.message)}
          {...form.register("name")}
        />
      </FormField>
      <FormField id="email" label="Email" error={errors.email?.message}>
        <TextInput
          type="email"
          autoComplete="email"
          {...fieldAria("email", errors.email?.message)}
          {...form.register("email")}
        />
      </FormField>
      <FormField
        id="password"
        label="Password"
        error={errors.password?.message}
        hint={`At least ${PASSWORD_MIN} characters.`}
      >
        <TextInput
          type="password"
          autoComplete="new-password"
          {...fieldAria("password", errors.password?.message, true)}
          {...form.register("password")}
        />
      </FormField>
      <FormField id="confirmPassword" label="Confirm password" error={errors.confirmPassword?.message}>
        <TextInput
          type="password"
          autoComplete="new-password"
          {...fieldAria("confirmPassword", errors.confirmPassword?.message)}
          {...form.register("confirmPassword")}
        />
      </FormField>
      <Button type="submit" size="lg" disabled={isSubmitting} className="mt-1 w-full">
        {isSubmitting ? "Creating account..." : "Create account"}
      </Button>
    </form>
  );
}
