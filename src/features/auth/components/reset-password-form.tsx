"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { fieldAria, FormField, TextInput } from "@/components/shared/form-controls";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth/auth-client";
import { PASSWORD_MIN, resetPasswordSchema, type ResetPasswordValues } from "../schemas";
import { FormAlert } from "./auth-card";

export function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const linkError = searchParams.get("error");
  const [error, setError] = useState<string | null>(null);
  const form = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });
  const { errors, isSubmitting } = form.formState;

  if (!token || linkError) {
    return (
      <div>
        <FormAlert>This reset link is invalid or has expired.</FormAlert>
        <Link href="/forgot-password" className="text-[13px] font-bold text-brand hover:underline">
          Request a new link
        </Link>
      </div>
    );
  }

  async function onSubmit(values: ResetPasswordValues) {
    setError(null);
    const { error: resetError } = await authClient.resetPassword({
      newPassword: values.password,
      token: token!,
    });
    if (resetError) {
      setError(
        resetError.status === 429
          ? "Too many attempts. Please wait and try again."
          : "This reset link is invalid or has expired.",
      );
      return;
    }
    router.replace("/login?reset=1");
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
      {error ? <FormAlert>{error}</FormAlert> : null}
      <FormField
        id="password"
        label="New password"
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
      <FormField id="confirmPassword" label="Confirm new password" error={errors.confirmPassword?.message}>
        <TextInput
          type="password"
          autoComplete="new-password"
          {...fieldAria("confirmPassword", errors.confirmPassword?.message)}
          {...form.register("confirmPassword")}
        />
      </FormField>
      <Button type="submit" size="lg" disabled={isSubmitting} className="w-full">
        {isSubmitting ? "Saving..." : "Set new password"}
      </Button>
    </form>
  );
}
