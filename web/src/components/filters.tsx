import { Search } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";

export function FilterBar({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-end gap-3">{children}</div>;
}

interface SearchFieldProps {
  id: string;
  label: string;
  placeholder: string;
  value: string | undefined;
  onSearch: (value: string | undefined) => void;
}

/** A search box that asks the server when you press Enter or Search. */
export function SearchField({ id, label, placeholder, value, onSearch }: SearchFieldProps) {
  return (
    <form
      role="search"
      className="flex min-w-64 flex-1 items-end gap-2"
      // A new key when the address changes resets the box to what is searched.
      key={value ?? ""}
      onSubmit={(event) => {
        event.preventDefault();
        const text = String(new FormData(event.currentTarget).get("q") ?? "").trim();
        onSearch(text || undefined);
      }}
    >
      <div className="grid flex-1 gap-1.5">
        <Label htmlFor={id}>{label}</Label>
        <Input
          id={id}
          name="q"
          type="search"
          defaultValue={value}
          placeholder={placeholder}
          autoComplete="off"
        />
      </div>
      <Button type="submit" variant="secondary">
        <Search aria-hidden="true" />
        Search
      </Button>
    </form>
  );
}

interface SelectFieldProps {
  id: string;
  label: string;
  allLabel: string;
  value: string | undefined;
  options: { value: string; label: string }[];
  onChange: (value: string | undefined) => void;
  /** The options did not load: say so rather than offer a menu with only `allLabel`. */
  failed?: { what: string; onRetry: () => void };
}

export function SelectField({ id, label, allLabel, value, options, onChange, failed }: SelectFieldProps) {
  return (
    <div className="grid gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <Label htmlFor={id}>{label}</Label>
        {failed ? (
          <Button
            variant="link"
            size="xs"
            className="h-auto p-0"
            aria-label={`Try again: ${label}`}
            onClick={failed.onRetry}
          >
            Try again
          </Button>
        ) : null}
      </div>
      <NativeSelect
        id={id}
        value={failed ? "" : (value ?? "")}
        disabled={Boolean(failed)}
        onChange={(event) => onChange(event.target.value || undefined)}
      >
        {failed ? (
          <NativeSelectOption value="">{failed.what} did not load</NativeSelectOption>
        ) : (
          <>
            <NativeSelectOption value="">{allLabel}</NativeSelectOption>
            {options.map((option) => (
              <NativeSelectOption key={option.value} value={option.value}>
                {option.label}
              </NativeSelectOption>
            ))}
          </>
        )}
      </NativeSelect>
    </div>
  );
}

interface DateFieldProps {
  id: string;
  label: string;
  value: string | undefined;
  onChange: (value: string | undefined) => void;
}

export function DateField({ id, label, value, onChange }: DateFieldProps) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="date"
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value || undefined)}
      />
    </div>
  );
}
