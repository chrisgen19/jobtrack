import type { ComponentProps, ReactNode } from "react";
import type { FieldMark } from "@/lib/draft";

const control =
  "w-full rounded-[9px] border border-line bg-white px-2.5 py-2 text-xs text-ink outline-none placeholder:text-faint focus:border-brand focus:ring-2 focus:ring-brand/15 aria-invalid:border-danger";

export type { FieldMark };

const MARK = {
  check: {
    text: "check",
    title: "Guessed from the page text. Check it before saving.",
    className: "bg-[#fdf6ea] text-warning",
  },
  ai: {
    text: "AI",
    title: "Suggested by AI from the posting. Check it before saving.",
    className: "bg-[#eef0fb] text-[#4f5aa8]",
  },
} satisfies Record<FieldMark, { text: string; title: string; className: string }>;

export function Field({
  id,
  label,
  error,
  mark,
  children,
  className = "",
}: {
  id: string;
  label: string;
  error?: string;
  mark?: FieldMark;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex min-w-0 flex-col gap-1 ${className}`}>
      <label
        htmlFor={id}
        className="flex items-center gap-1.5 text-[10px] font-bold tracking-[0.6px] text-subtle uppercase"
      >
        {label}
        {mark ? (
          <span
            title={MARK[mark].title}
            className={`rounded-[5px] px-1 py-px text-[9px] tracking-normal normal-case ${MARK[mark].className}`}
          >
            {MARK[mark].text}
          </span>
        ) : null}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-[11px] text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function TextInput({ invalid, ...props }: ComponentProps<"input"> & { invalid?: boolean }) {
  return (
    <input
      className={control}
      aria-invalid={invalid || undefined}
      aria-describedby={invalid ? `${props.id}-error` : undefined}
      {...props}
    />
  );
}

export function TextArea(props: ComponentProps<"textarea">) {
  return <textarea className={`${control} resize-y leading-relaxed`} {...props} />;
}

export function Select({
  options,
  placeholder,
  invalid,
  ...props
}: ComponentProps<"select"> & {
  options: { value: string; label: string }[];
  placeholder?: string;
  invalid?: boolean;
}) {
  return (
    <select
      className={control}
      aria-invalid={invalid || undefined}
      aria-describedby={invalid ? `${props.id}-error` : undefined}
      {...props}
    >
      {placeholder !== undefined ? <option value="">{placeholder}</option> : null}
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ComponentProps<"button"> & { variant?: "primary" | "outline" | "ghost" }) {
  const variants = {
    primary: "bg-brand text-white hover:bg-brand-dark disabled:opacity-60",
    outline: "border border-line bg-white text-ink hover:bg-surface-2 disabled:opacity-60",
    ghost: "text-subtle hover:text-ink",
  };
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-1.5 rounded-[9px] px-3 py-2 text-xs font-bold transition-colors focus-visible:ring-2 focus-visible:ring-brand/30 focus-visible:outline-none ${variants[variant]} ${className}`}
      {...props}
    />
  );
}

export function Notice({
  tone = "info",
  children,
}: {
  tone?: "info" | "warning" | "error";
  children: ReactNode;
}) {
  const tones = {
    info: "border-[#dce6ef] bg-[#f0f5fa] text-[#46627f]",
    warning: "border-[#efe3cf] bg-[#fdf6ea] text-warning",
    error: "border-[#f1d4d1] bg-[#fbeceb] text-[#9d3f37]",
  };
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`rounded-[10px] border px-3 py-2.5 text-[11px] leading-relaxed ${tones[tone]}`}
    >
      {children}
    </div>
  );
}
