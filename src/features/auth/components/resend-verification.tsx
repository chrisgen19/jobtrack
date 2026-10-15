"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth/auth-client";
import { FormAlert } from "./auth-card";

export function ResendVerification() {
  const email = useSearchParams().get("email");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "limited">("idle");

  if (!email) return null;

  async function resend() {
    setState("sending");
    const { error } = await authClient.sendVerificationEmail({ email: email!, callbackURL: "/dashboard" });
    setState(error?.status === 429 ? "limited" : "sent");
  }

  return (
    <div className="flex flex-col gap-3">
      {state === "sent" ? <FormAlert tone="success">A new verification link has been sent.</FormAlert> : null}
      {state === "limited" ? (
        <FormAlert>Please wait a few minutes before requesting another link.</FormAlert>
      ) : null}
      <Button variant="outline" onClick={resend} disabled={state === "sending"}>
        {state === "sending" ? "Sending..." : "Resend verification email"}
      </Button>
    </div>
  );
}
