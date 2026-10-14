import type { ComponentProps, ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

/** Input/select/textarea styling from the mockup's form fields. */
const CONTROL =
  "min-h-10 rounded-[9px] border-[#dfe7df] bg-white px-3 text-[13px] text-[#304a3b] focus-visible:border-[#5b9e77] focus-visible:ring-[#1e8f5620]";

interface FormFieldProps {
  id: string;
  label: string;
  required?: boolean;
  hint?: ReactNode;
  error?: string;
  className?: string;
  children: ReactNode;
}

/** Label + control + hint/error, wired with aria attributes by id. */
export function FormField({ id, label, required, hint, error, className, children }: FormFieldProps) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <Label htmlFor={id} className="text-[11px] font-bold text-[#657c6b]">
        {label}
        {required ? <span aria-hidden> *</span> : null}
      </Label>
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-[11px] text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-[10px] leading-normal text-[#99a69d]">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function TextInput({ className, ...props }: ComponentProps<typeof Input>) {
  return <Input className={cn(CONTROL, "h-10", className)} {...props} />;
}

export function TextArea({ className, ...props }: ComponentProps<typeof Textarea>) {
  return <Textarea className={cn(CONTROL, "min-h-[88px] py-2.5 leading-normal", className)} {...props} />;
}

const SELECT_WRAPPER =
  "w-full [&>select]:h-10 [&>select]:rounded-[9px] [&>select]:border-[#dfe7df] [&>select]:bg-white [&>select]:pl-3 [&>select]:text-[13px] [&>select]:text-[#304a3b] [&>select:focus-visible]:border-[#5b9e77]";

type Option = { value: string; label: string };

interface SelectInputProps extends Omit<ComponentProps<"select">, "size"> {
  options: Option[];
  placeholder?: string;
  wrapperClassName?: string;
}

export function SelectInput({
  options,
  placeholder,
  className,
  wrapperClassName,
  ...props
}: SelectInputProps) {
  return (
    <NativeSelect className={cn(SELECT_WRAPPER, wrapperClassName, className)} {...props}>
      {placeholder !== undefined ? <NativeSelectOption value="">{placeholder}</NativeSelectOption> : null}
      {options.map((option) => (
        <NativeSelectOption key={option.value} value={option.value}>
          {option.label}
        </NativeSelectOption>
      ))}
    </NativeSelect>
  );
}

/** aria props for a control described by FormField's hint/error. */
export function fieldAria(id: string, error?: string, hasHint?: boolean) {
  return {
    id,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": error ? `${id}-error` : hasHint ? `${id}-hint` : undefined,
  } as const;
}
