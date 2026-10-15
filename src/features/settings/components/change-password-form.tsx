"use client";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { FormField, TextInput } from "@/components/shared/form-controls";
import { Button } from "@/components/ui/button";
import { PASSWORD_MIN } from "@/features/auth/schemas";
import { authClient } from "@/lib/auth/auth-client";

export function ChangePasswordForm() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const currentPassword = String(data.get("currentPassword") ?? "");
    const newPassword = String(data.get("newPassword") ?? "");
    if (newPassword.length < PASSWORD_MIN) {
      setError(`Use at least ${PASSWORD_MIN} characters.`);
      return;
    }
    if (newPassword !== data.get("confirmPassword")) {
      setError("Passwords do not match.");
      return;
    }
    setError(null);
    setPending(true);
    const { error: changeError } = await authClient.changePassword({
      currentPassword,
      newPassword,
      revokeOtherSessions: true,
    });
    setPending(false);
    if (changeError) {
      setError(
        changeError.status === 429
          ? "Too many attempts. Try again later."
          : "Your current password is incorrect.",
      );
      return;
    }
    form.reset();
    toast.success("Password changed. Other sessions were signed out.");
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-3">
      <FormField id="currentPassword" label="Current password">
        <TextInput
          id="currentPassword"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
        />
      </FormField>
      <FormField
        id="newPassword"
        label="New password"
        hint={`At least ${PASSWORD_MIN} characters.`}
        error={error ?? undefined}
      >
        <TextInput id="newPassword" name="newPassword" type="password" autoComplete="new-password" required />
      </FormField>
      <FormField id="confirmPassword" label="Confirm new password">
        <TextInput
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
        />
      </FormField>
      <div className="sm:col-span-3">
        <Button type="submit" variant="outline" disabled={pending}>
          {pending ? "Updating..." : "Change password"}
        </Button>
      </div>
    </form>
  );
}
