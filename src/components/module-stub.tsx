/**
 * Placeholder untuk modul yang belum diimplementasikan.
 * Digunakan sepanjang fase pondasi supaya navigasi utuh.
 */
export function ModuleStub({
  title,
  description,
  features,
}: {
  title: string;
  description: string;
  features: string[];
}) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>

      <div className="rounded-lg border border-border bg-card p-6 text-card-foreground">
        <h2 className="font-semibold">Rencana fitur</h2>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
          {features.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
      </div>

      <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
        <strong className="text-foreground">Belum diimplementasikan.</strong> Modul ini
        menunggu pengesahan Decision Gate (M-01–M-10) dan finalisasi kontrak API dengan
        VPS.
      </div>
    </div>
  );
}
