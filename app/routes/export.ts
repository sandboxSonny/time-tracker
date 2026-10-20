import type { Route } from "./+types/export";
import { listEntries } from "~/db.server";
import { requireAuth } from "~/session.server";

// Quote fields and neutralise spreadsheet formula injection (cells starting with = + - @ are prefixed with a quote).
const csv = (v: string | number) => {
  const s = String(v);
  return `"${(/^[=+\-@\t\r]/.test(s) ? "'" + s : s).replace(/"/g, '""')}"`;
};

export async function loader({ request }: Route.LoaderArgs) {
  await requireAuth(request);
  const url = new URL(request.url);
  const month = url.searchParams.get("month") ?? "";
  const entries = listEntries({
    clientId: Number(url.searchParams.get("client")) || undefined,
    month: /^\d{4}-\d{2}$/.test(month) ? month : undefined,
  });
  const rows = [
    ["Date", "Client", "Description", "Hours"].map(csv).join(","),
    ...entries.map((e) => [e.entry_date, e.client_name, e.description, (e.minutes / 60).toFixed(2)].map(csv).join(",")),
  ];
  return new Response(rows.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="time-entries.csv"',
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
