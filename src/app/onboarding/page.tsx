import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Brand } from "@/components/layout/brand";
import { Skeleton } from "@/components/ui/skeleton";
import { AuthCard } from "@/features/auth/components/auth-card";
import { OnboardingForm } from "@/features/workspace/components/onboarding-form";
import { getOnboardingState } from "@/features/workspace/data";
import { supportedTimeZones } from "@/lib/dates";
import { supportedCurrencies } from "@/lib/money";

export const metadata: Metadata = { title: "Set up your workspace" };

export default function OnboardingPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <div className="mb-8">
        <Brand href="/" />
      </div>
      <Suspense fallback={<Skeleton className="h-[420px] w-full max-w-[420px] rounded-2xl" />}>
        <Onboarding />
      </Suspense>
    </main>
  );
}

async function Onboarding() {
  const { user, onboarded } = await getOnboardingState();
  if (onboarded) redirect("/dashboard");
  return (
    <AuthCard
      title={`Welcome, ${user.name.split(" ")[0]}`}
      description="Two quick choices and your private job search workspace is ready."
    >
      <OnboardingForm timeZones={supportedTimeZones()} currencies={supportedCurrencies()} />
    </AuthCard>
  );
}
