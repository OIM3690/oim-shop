import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { formatMonth, isReversed, monthsBack } from "@/lib/months";

interface DateRangeProps {
  from: string | undefined;
  to: string | undefined;
  onChange: (range: { from?: string; to?: string }) => void;
}

// The API covers at most 120 months, so the menus offer the last 120.
const MONTHS = monthsBack(120);
const thisMonth = MONTHS[0];
const thisYear = thisMonth.slice(0, 4);

const PRESETS = [
  { id: "12", label: "Last 12 months", range: {} },
  { id: "year", label: "This year", range: { from: `${thisYear}-01`, to: thisMonth } },
  {
    id: "last-year",
    label: "Last year",
    range: { from: `${Number(thisYear) - 1}-01`, to: `${Number(thisYear) - 1}-12` },
  },
  { id: "5y", label: "Last 5 years", range: { from: MONTHS[59], to: thisMonth } },
  { id: "10y", label: "Last 10 years", range: { from: MONTHS[119], to: thisMonth } },
] as const;

const REVERSED = "The From month is after the To month.";

/**
 * A preset and the two months of the range, in one row above the charts.
 * Choosing a month past the other end moves that end with it, so the menus
 * never make a reversed range; one typed into the address is flagged here.
 */
export function DateRange({ from, to, onChange }: DateRangeProps) {
  const start = from ?? MONTHS[11];
  const end = to ?? thisMonth;
  const preset = PRESETS.find((p) =>
    "from" in p.range ? p.range.from === from && p.range.to === to : !from && !to,
  );

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="grid gap-1.5">
        <Label htmlFor="range-preset">Period</Label>
        <NativeSelect
          id="range-preset"
          value={preset?.id ?? "custom"}
          onChange={(event) => {
            const chosen = PRESETS.find((p) => p.id === event.target.value);
            if (chosen) onChange({ ...chosen.range });
          }}
        >
          {PRESETS.map((p) => (
            <NativeSelectOption key={p.id} value={p.id}>
              {p.label}
            </NativeSelectOption>
          ))}
          {preset ? null : <NativeSelectOption value="custom">Custom</NativeSelectOption>}
        </NativeSelect>
      </div>
      <MonthField
        id="range-from"
        label="From"
        value={start}
        onChange={(m) => onChange({ from: m, to: m > end ? m : end })}
      />
      <MonthField
        id="range-to"
        label="To"
        value={end}
        onChange={(m) => onChange({ from: m < start ? m : start, to: m })}
        error={isReversed(from, to) ? REVERSED : undefined}
      />
    </div>
  );
}

function MonthField({
  id,
  label,
  value,
  onChange,
  error,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (m: string) => void;
  error?: string;
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <NativeSelect
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
      >
        {/* A month from the address may be older than the menu reaches; show it anyway. */}
        {(MONTHS.includes(value) ? MONTHS : [...MONTHS, value].sort().reverse()).map((m) => (
          <NativeSelectOption key={m} value={m}>
            {formatMonth(m)}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
    </div>
  );
}
