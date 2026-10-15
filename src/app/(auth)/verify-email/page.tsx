import { MailCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AuthCard } from "@/features/auth/components/auth-card";
import { ResendVerification } from "@/features/auth/components/resend-verification";

export const metadata: Metadata = { title: "Verify your email" };

export default function VerifyEmailPage() {
  return (
    <AuthCard
      title="Check your inbox"
      description="We sent a verification link to your email. Open it to activate your workspace. The link expires in 1 hour."
      footer={
        <Link href="/login" className="font-bold text-brand hover:underline">
          Back to sign in
        </Link>
      }
    >
      <div
        className="mb-5 grid size-12 place-items-center rounded-[14px] bg-brand-soft text-brand"
        aria-hidden
      >
        <MailCheck className="size-5" />
      </div>
      <Suspense>
        <ResendVerification />
      </Suspense>
    </AuthCard>
  );
}
