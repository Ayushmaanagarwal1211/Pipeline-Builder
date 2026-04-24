"use client";

import type {
  ChangeEvent,
  InputHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

const FIELD_BASE_CLASS =
  "w-full rounded-md border border-border/60 bg-background/60 px-2 py-1 text-[11px] text-foreground placeholder:text-muted-foreground focus:border-foreground/40 focus:outline-none disabled:cursor-not-allowed disabled:opacity-40";

type NodeTextareaProps = Omit<
  TextareaHTMLAttributes<HTMLTextAreaElement>,
  "className"
>;

export function NodeTextarea({
  rows = 3,
  ...props
}: NodeTextareaProps) {
  return (
    <textarea
      rows={rows}
      {...props}
      className={`${FIELD_BASE_CLASS} resize-none font-normal`}
    />
  );
}

type NodeInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "className"
>;

export function NodeInput(props: NodeInputProps) {
  return <input {...props} className={FIELD_BASE_CLASS} />;
}

/**
 * Numeric input with clamp-to-range on blur. Prevents NaN from reaching state.
 */
export function NodeNumberInput({
  value,
  onChange,
  min = 0,
  max = 100,
  disabled,
}: {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
}) {
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const parsed = Number.parseFloat(event.target.value);
    if (Number.isNaN(parsed)) return;
    const clamped = Math.min(Math.max(parsed, min), max);
    onChange(clamped);
  };

  return (
    <input
      type="number"
      min={min}
      max={max}
      value={Number.isFinite(value) ? value : 0}
      onChange={handleChange}
      disabled={disabled}
      className={FIELD_BASE_CLASS}
    />
  );
}

type NodeSelectProps = Omit<
  SelectHTMLAttributes<HTMLSelectElement>,
  "className"
> & {
  readonly options: readonly { readonly value: string; readonly label: string }[];
};

export function NodeSelect({ options, ...props }: NodeSelectProps) {
  return (
    <select {...props} className={FIELD_BASE_CLASS}>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

/**
 * Informational read-only display for a field driven by an upstream connection.
 */
export function NodeConnectedValue({ label }: { label: string }) {
  return (
    <div
      className={`${FIELD_BASE_CLASS} flex items-center gap-1 !opacity-60`}
      aria-disabled
    >
      <span className="size-1.5 rounded-full bg-emerald-400" />
      <span className="truncate italic">{label}</span>
    </div>
  );
}
