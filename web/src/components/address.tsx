/** A postal address as Northwind stores it, one line per part, skipping the parts not recorded. */
export function Address({
  name,
  address,
  city,
  region,
  postal_code,
  country,
}: {
  name?: string | null;
  address: string | null;
  city: string | null;
  region: string | null;
  postal_code: string | null;
  country: string | null;
}) {
  const lines = [
    name,
    address,
    [postal_code, city].filter(Boolean).join(" "),
    [region, country].filter(Boolean).join(", "),
  ].filter(Boolean);
  if (lines.length === 0) return <span className="text-muted-foreground">Not recorded</span>;
  return (
    <>
      {lines.map((line) => (
        // An address can hold a line break of its own, as "Coventry House\nMiner Rd." does.
        <span key={line} className="block whitespace-pre-line">
          {line}
        </span>
      ))}
    </>
  );
}

/** A person's name with their title below it, as in a contact. */
export function NameAndTitle({ name, title }: { name: string | null; title: string | null }) {
  return (
    <>
      <span className="block">{name ?? "Not recorded"}</span>
      {title ? <span className="text-muted-foreground block text-sm">{title}</span> : null}
    </>
  );
}
