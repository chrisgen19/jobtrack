"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { FormField, TextInput } from "@/components/shared/form-controls";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth/auth-client";

export function ProfileForm({ name, email }: { name: string; email: string }) {
  const router = useRouter();
  const [value, setValue] = useState(name);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = value.trim();
    if (!trimmed || trimmed.length > 80) {
      toast.error("Enter a name between 1 and 80 characters.");
      return;
    }
    setPending(true);
    const { error } = await authClient.updateUser({ name: trimmed });
    setPending(false);
    if (error) {
      toast.error("Could not update your profile.");
      return;
    }
    toast.success("Profile updated");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
      <FormField id="profile-name" label="Full name">
        <TextInput
          id="profile-name"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          maxLength={80}
        />
      </FormField>
      <FormField id="profile-email" label="Email" hint="Email changes are not supported yet.">
        <TextInput id="profile-email" value={email} disabled readOnly />
      </FormField>
      <div className="sm:col-span-2">
        <Button type="submit" disabled={pending || value.trim() === name}>
          {pending ? "Saving..." : "Save profile"}
        </Button>
      </div>
    </form>
  );
}
