"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FormField, TextInput } from "@/components/shared/form-controls";
import { Button } from "@/components/ui/button";
import { FormAlert } from "@/features/auth/components/auth-card";
import { authClient } from "@/lib/auth/auth-client";

/** Permanent account deletion: requires typing the email and the password. */
export function DeleteAccountForm({ email }: { email: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <form
      className="grid gap-4 sm:grid-cols-2"
      onSubmit={async (event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        if (String(data.get("confirmEmail")).trim().toLowerCase() !== email.toLowerCase()) {
          setError("Type your account email exactly to confirm.");
          return;
        }
        setPending(true);
        setError(null);
        const { error: deleteError } = await authClient.deleteUser({
          password: String(data.get("password") ?? ""),
        });
        setPending(false);
        if (deleteError) {
          setError(
            deleteError.status === 429
              ? "Too many attempts. Try again later."
              : "Your password is incorrect.",
          );
          return;
        }
        router.replace("/?deleted=1");
        router.refresh();
      }}
    >
      {error ? (
        <div className="sm:col-span-2">
          <FormAlert>{error}</FormAlert>
        </div>
      ) : null}
      <FormField id="confirmEmail" label={`Type ${email} to confirm`}>
        <TextInput id="confirmEmail" name="confirmEmail" autoComplete="off" required />
      </FormField>
      <FormField id="delete-password" label="Password">
        <TextInput
          id="delete-password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </FormField>
      <div className="sm:col-span-2">
        <Button type="submit" variant="destructive" disabled={pending}>
          {pending ? "Deleting..." : "Delete my account permanently"}
        </Button>
      </div>
    </form>
  );
}
