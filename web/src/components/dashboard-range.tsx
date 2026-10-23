import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { formatMonth, monthsBack } from "@/lib/months";

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

/** A preset and the two months of the range, in one row above the charts. */
export function DateRange({ from, to, onChange }: DateRangeProps) {
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
        value={from ?? MONTHS[11]}
        onChange={(m) => onChange({ from: m, to: to ?? thisMonth })}
      />
      <MonthField
        id="range-to"
        label="To"
        value={to ?? thisMonth}
        onChange={(m) => onChange({ from: from ?? MONTHS[11], to: m })}
      />
    </div>
  );
}

function MonthField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (m: string) => void;
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <NativeSelect id={id} value={value} onChange={(event) => onChange(event.target.value)}>
        {MONTHS.map((m) => (
          <NativeSelectOption key={m} value={m}>
            {formatMonth(m)}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </div>
  );
}
