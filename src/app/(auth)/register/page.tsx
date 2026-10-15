import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/features/auth/components/auth-card";
import { RegisterForm } from "@/features/auth/components/register-form";

export const metadata: Metadata = { title: "Create account" };

export default function RegisterPage() {
  return (
    <AuthCard
      title="Create your workspace"
      description="Free and private. Only a job title and company are needed to start tracking."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="font-bold text-brand hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <RegisterForm />
    </AuthCard>
  );
}
