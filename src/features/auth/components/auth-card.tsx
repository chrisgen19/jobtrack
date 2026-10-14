import type { ReactNode } from "react";

interface AuthCardProps {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}

export function AuthCard({ title, description, children, footer }: AuthCardProps) {
  return (
    <div className="w-full max-w-[420px]">
      <div className="rounded-2xl border border-line bg-card p-6 shadow-panel sm:p-8">
        <h1 className="text-[24px] font-bold tracking-[-0.9px] text-heading">{title}</h1>
        {description ? <p className="mt-2 text-[13px] leading-relaxed text-subtle">{description}</p> : null}
        <div className="mt-6">{children}</div>
      </div>
      {footer ? <div className="mt-5 text-center text-[13px] text-subtle">{footer}</div> : null}
    </div>
  );
}

export function FormAlert({
  tone = "error",
  children,
}: {
  tone?: "error" | "success" | "info";
  children: ReactNode;
}) {
  const tones = {
    error: "border-[#f1d4d1] bg-[#fbeceb] text-[#9d3f37]",
    success: "border-[#dce9df] bg-[#eef6ef] text-[#246449]",
    info: "border-[#dce6ef] bg-[#f0f5fa] text-[#46627f]",
  } as const;
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`mb-4 rounded-xl border px-3.5 py-3 text-xs leading-relaxed ${tones[tone]}`}
    >
      {children}
    </div>
  );
}
