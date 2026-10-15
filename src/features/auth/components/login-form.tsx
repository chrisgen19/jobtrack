"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { fieldAria, FormField, TextInput } from "@/components/shared/form-controls";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth/auth-client";
import { loginSchema, safeRedirectPath, type LoginValues } from "../schemas";
import { FormAlert } from "./auth-card";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeRedirectPath(searchParams.get("next"));
  const [error, setError] = useState<string | null>(null);
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(() => {
    if (searchParams.get("reset") === "1") return "Password updated. Sign in with your new password.";
    if (searchParams.get("verified") === "1") return "Email verified. You can sign in now.";
    return null;
  });

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "", rememberMe: true },
  });
  const { errors, isSubmitting } = form.formState;

  async function onSubmit(values: LoginValues) {
    setError(null);
    setNotice(null);
    setUnverifiedEmail(null);
    const { error: signInError } = await authClient.signIn.email({
      email: values.email,
      password: values.password,
      rememberMe: values.rememberMe,
    });
    if (signInError) {
      if (signInError.status === 403) {
        setUnverifiedEmail(values.email);
        setError("Please verify your email address before signing in.");
      } else if (signInError.status === 429) {
        setError("Too many attempts. Please wait a minute and try again.");
      } else {
        setError("Incorrect email or password.");
      }
      return;
    }
    router.replace(next);
    router.refresh();
  }

  async function resendVerification() {
    if (!unverifiedEmail) return;
    await authClient.sendVerificationEmail({ email: unverifiedEmail, callbackURL: "/dashboard" });
    setError(null);
    setNotice("If that account exists and is unverified, a new verification link is on its way.");
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
      {notice ? <FormAlert tone="success">{notice}</FormAlert> : null}
      {error ? (
        <FormAlert>
          {error}
          {unverifiedEmail ? (
            <button type="button" onClick={resendVerification} className="ml-1 font-bold underline">
              Resend verification email
            </button>
          ) : null}
        </FormAlert>
      ) : null}
      <FormField id="email" label="Email" error={errors.email?.message}>
        <TextInput
          type="email"
          autoComplete="email"
          {...fieldAria("email", errors.email?.message)}
          {...form.register("email")}
        />
      </FormField>
      <FormField id="password" label="Password" error={errors.password?.message}>
        <TextInput
          type="password"
          autoComplete="current-password"
          {...fieldAria("password", errors.password?.message)}
          {...form.register("password")}
        />
      </FormField>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Controller
            control={form.control}
            name="rememberMe"
            render={({ field }) => (
              <Checkbox
                id="rememberMe"
                checked={field.value}
                onCheckedChange={(checked) => field.onChange(checked === true)}
              />
            )}
          />
          <Label htmlFor="rememberMe" className="text-xs font-medium text-subtle">
            Keep me signed in
          </Label>
        </div>
        <Link href="/forgot-password" className="text-xs font-bold text-brand hover:underline">
          Forgot password?
        </Link>
      </div>
      <Button type="submit" size="lg" disabled={isSubmitting} className="mt-1 w-full">
        {isSubmitting ? "Signing in..." : "Sign in"}
      </Button>
    </form>
  );
}
