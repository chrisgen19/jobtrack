import { useState, type KeyboardEvent } from "react";
import { X } from "lucide-react";

type Props = {
  id: string;
  values: string[];
  onChange: (values: string[]) => void;
  maxItems: number;
  maxLength: number;
  placeholder?: string;
};

/** List of short values (skills, tags): Enter or a comma adds one, Backspace on an empty input removes the last. */
export function ChipsInput({ id, values, onChange, maxItems, maxLength, placeholder }: Props) {
  const [text, setText] = useState("");
  const full = values.length >= maxItems;

  function add(raw: string) {
    const items = raw
      .split(/[,\n]/)
      .map((item) => item.trim().slice(0, maxLength))
      .filter(Boolean);
    const next = [...new Set([...values, ...items])].slice(0, maxItems);
    if (next.length !== values.length) onChange(next);
    setText("");
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if ((event.key === "Enter" || event.key === ",") && text.trim()) {
      event.preventDefault();
      add(text);
    } else if (event.key === "Backspace" && !text && values.length) {
      onChange(values.slice(0, -1));
    }
  }

  return (
    <div className="flex min-h-[34px] w-full flex-wrap items-center gap-1 rounded-[9px] border border-line bg-white px-1.5 py-1 focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/15">
      {values.map((value) => (
        <span
          key={value}
          className="inline-flex max-w-full items-center gap-0.5 rounded-[6px] bg-brand-soft py-0.5 pr-0.5 pl-1.5 text-[11px] text-brand-dark"
        >
          <span className="truncate">{value}</span>
          <button
            type="button"
            aria-label={`Remove ${value}`}
            className="rounded p-0.5 hover:bg-white/60"
            onClick={() => onChange(values.filter((item) => item !== value))}
          >
            <X className="size-3" aria-hidden />
          </button>
        </span>
      ))}
      <input
        id={id}
        value={text}
        disabled={full}
        placeholder={full ? `Up to ${maxItems}` : values.length ? "" : placeholder}
        onChange={(event) => {
          const value = event.target.value;
          if (value.includes(",")) add(value);
          else setText(value.slice(0, maxLength));
        }}
        onKeyDown={onKeyDown}
        onBlur={() => text.trim() && add(text)}
        className="min-w-[80px] flex-1 border-0 bg-transparent px-1 py-0.5 text-xs text-ink outline-none placeholder:text-faint"
      />
    </div>
  );
}
