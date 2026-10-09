import { Minus, Plus } from "lucide-react";

export function QtyStepper({
  value,
  min = 1,
  max,
  onChange,
  label,
}: {
  value: number;
  min?: number;
  max: number;
  onChange: (next: number) => void;
  label: string;
}) {
  return (
    <div className="inline-flex items-center border border-line bg-paper">
      <button
        type="button"
        className="inline-flex size-11 items-center justify-center disabled:opacity-40"
        onClick={() => onChange(value - 1)}
        disabled={value <= min}
        aria-label={`Fewer copies of ${label}`}
      >
        <Minus className="size-4" />
      </button>
      <span className="w-8 text-center text-sm tabular-nums" aria-live="polite">
        {value}
      </span>
      <button
        type="button"
        className="inline-flex size-11 items-center justify-center disabled:opacity-40"
        onClick={() => onChange(value + 1)}
        disabled={value >= max}
        aria-label={`More copies of ${label}`}
      >
        <Plus className="size-4" />
      </button>
    </div>
  );
}
