import { useEffect, useRef, useState } from "react";
import { Form, Link, useNavigate, useSubmit } from "react-router";
import type { Route } from "./+types/entries";
import { addEntry, deleteEntry, listClients, listEntries } from "~/db.server";
import { requireAuth } from "~/session.server";
import { formatDuration, parseDuration } from "~/time";

export async function loader({ request }: Route.LoaderArgs) {
  await requireAuth(request);
  const url = new URL(request.url);
  const clientId = Number(url.searchParams.get("client")) || undefined;
  const month = /^\d{4}-\d{2}$/.test(url.searchParams.get("month") ?? "") ? url.searchParams.get("month")! : undefined;
  const entries = listEntries({ clientId, month });
  const totals = new Map<string, number>();
  const days = new Map<string, typeof entries>();
  for (const e of entries) {
    totals.set(e.client_name, (totals.get(e.client_name) ?? 0) + e.minutes);
    days.set(e.entry_date, [...(days.get(e.entry_date) ?? []), e]);
  }
  return {
    clients: listClients(true),
    days: [...days],
    totals: [...totals],
    total: entries.reduce((n, e) => n + e.minutes, 0),
    count: entries.length,
    filter: { client: clientId ?? 0, month: month ?? "" },
  };
}

export async function action({ request }: Route.ActionArgs) {
  await requireAuth(request);
  const form = await request.formData();
  if (form.get("intent") === "delete") {
    deleteEntry(Number(form.get("id")));
    return { ok: true };
  }
  const clientId = Number(form.get("client"));
  const date = String(form.get("date") ?? "");
  const description = String(form.get("description") ?? "")
    .trim()
    .slice(0, 200);
  const minutes = parseDuration(String(form.get("duration") ?? ""));
  if (!clientId) return { error: "Choose a client." };
  const parsed = new Date(`${date}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || isNaN(+parsed) || parsed.toISOString().slice(0, 10) !== date) {
    return { error: "Enter a valid date." };
  }
  if (!description) return { error: "Add a short description." };
  if (!minutes) return { error: "Duration not recognised. Try 1.5, 1:30, 90m or 1h30m." };
  addEntry({ clientId, date, description, minutes });
  return { ok: true };
}

const dayLabel = (d: string) =>
  new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });

type FilterClient = { id: number; name: string; archived: number };

function DesktopClientFilter({
  clients,
  current,
  href,
}: {
  clients: FilterClient[];
  current: number;
  href: (id: number) => string;
}) {
  const navigate = useNavigate();
  const root = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = clients.find((c) => c.id === current);
  const q = query.trim().toLowerCase();
  const shown = clients.filter((c) => c.name.toLowerCase().includes(q));
  const showAll = !q;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const pick = (id: number) => {
    setOpen(false);
    navigate(href(id));
  };

  return (
    <div ref={root} className="relative hidden lg:block">
      <button
        type="button"
        className={`btn btn-sm w-56 justify-between ${selected ? "btn-neutral" : "btn-soft"}`}
        onClick={() => {
          setQuery("");
          setOpen(!open);
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="truncate">{selected?.name ?? "All clients"}</span>
        <svg
          viewBox="0 0 24 24"
          className="size-4 shrink-0"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 flex w-72 flex-col gap-2 rounded-box border border-base-300 bg-base-100 p-2 shadow-lg">
          <input
            autoFocus
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setOpen(false);
              if (e.key === "Enter") {
                e.preventDefault();
                if (shown[0]) pick(shown[0].id);
                else if (showAll) pick(0);
              }
            }}
            placeholder={`Search ${clients.length} clients`}
            className="input input-sm w-full"
          />
          <ul className="menu max-h-72 flex-nowrap overflow-y-auto p-0" role="listbox">
            {showAll && (
              <li>
                <button type="button" className={current === 0 ? "menu-active" : ""} onClick={() => pick(0)}>
                  All clients
                </button>
              </li>
            )}
            {shown.map((c) => (
              <li key={c.id}>
                <button type="button" className={c.id === current ? "menu-active" : ""} onClick={() => pick(c.id)}>
                  <span className="truncate">{c.name}</span>
                  {c.archived ? <span className="badge badge-ghost badge-sm">archived</span> : null}
                </button>
              </li>
            ))}
            {!shown.length && (
              <li className="disabled">
                <span>No clients match.</span>
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

function ClientFilter({
  clients,
  current,
  href,
}: {
  clients: FilterClient[];
  current: number;
  href: (id: number) => string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState("");
  const selected = clients.find((c) => c.id === current);
  const shown = clients.filter((c) => c.name.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <>
      <DesktopClientFilter clients={clients} current={current} href={href} />

      <button
        type="button"
        className={`btn btn-sm max-w-[55%] justify-between gap-1 lg:hidden ${selected ? "btn-neutral" : "btn-soft"}`}
        onClick={() => {
          setQuery("");
          dialog.current?.showModal();
        }}
      >
        <span className="truncate">{selected?.name ?? "All clients"}</span>
        <svg
          viewBox="0 0 24 24"
          className="size-4 shrink-0"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      <dialog ref={dialog} className="modal modal-bottom lg:hidden">
        <div
          className="modal-box flex max-h-[80vh] w-full max-w-lg flex-col gap-3 rounded-t-3xl p-5"
          style={{
            paddingBottom: "calc(env(safe-area-inset-bottom) + 1.25rem)",
          }}
        >
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Filter by client</h2>
            <button
              type="button"
              className="btn btn-ghost btn-circle btn-sm"
              onClick={() => dialog.current?.close()}
              aria-label="Close"
            >
              <svg
                viewBox="0 0 24 24"
                className="size-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
              >
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${clients.length} clients`}
            className="input w-full"
          />
          <div className="flex flex-col gap-1 overflow-y-auto">
            {!query && (
              <Link
                to={href(0)}
                onClick={() => dialog.current?.close()}
                className={`btn justify-start ${current === 0 ? "btn-primary" : "btn-ghost"}`}
              >
                All clients
              </Link>
            )}
            {shown.map((c) => (
              <Link
                key={c.id}
                to={href(c.id)}
                onClick={() => dialog.current?.close()}
                className={`btn justify-start ${c.id === current ? "btn-primary" : "btn-ghost"}`}
              >
                <span className="truncate">{c.name}</span>
                {c.archived ? <span className="badge badge-ghost badge-sm">archived</span> : null}
              </Link>
            ))}
            {!shown.length && <p className="py-6 text-center text-sm opacity-60">No clients match.</p>}
          </div>
        </div>
        <div className="modal-backdrop">
          <button type="button" onClick={() => dialog.current?.close()}>
            close
          </button>
        </div>
      </dialog>
    </>
  );
}

function DeleteButton({ id }: { id: number }) {
  return (
    <Form method="post" onSubmit={(ev) => !confirm("Delete this entry?") && ev.preventDefault()}>
      <input type="hidden" name="intent" value="delete" />
      <input type="hidden" name="id" value={id} />
      <button className="btn btn-ghost btn-circle btn-sm text-error" aria-label="Delete entry">
        <svg
          viewBox="0 0 24 24"
          className="size-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" />
        </svg>
      </button>
    </Form>
  );
}

export default function Entries({ loaderData }: Route.ComponentProps) {
  const { clients, days, totals, total, count, filter } = loaderData;
  const submit = useSubmit();
  const chip = (id: number) => {
    const p = new URLSearchParams();
    if (id) p.set("client", String(id));
    if (filter.month) p.set("month", filter.month);
    return `/?${p}`;
  };

  return (
    <>
      <h1 className="hidden text-2xl font-bold lg:block">Entries</h1>

      <div className="lg:flex lg:items-stretch lg:gap-4">
        <div className="card bg-primary text-primary-content shadow lg:w-72 lg:shrink-0">
          <div className="card-body gap-1 p-5">
            <p className="text-sm opacity-80">
              {filter.month || "All time"} · {count} {count === 1 ? "entry" : "entries"}
            </p>
            <p className="text-4xl font-bold">{formatDuration(total)}</p>
            {totals.length > 1 && (
              <p className="text-sm opacity-80 lg:hidden">
                {totals.map(([n, m]) => `${n} ${formatDuration(m)}`).join(" · ")}
              </p>
            )}
          </div>
        </div>
        <div className="hidden flex-1 flex-wrap content-start gap-3 lg:flex">
          {totals.map(([n, m]) => (
            <div key={n} className="rounded-box bg-base-100 px-5 py-3 shadow-sm">
              <p className="text-sm opacity-60">{n}</p>
              <p className="text-xl font-semibold">{formatDuration(m)}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <ClientFilter clients={clients} current={filter.client} href={chip} />
        <Form method="get" onChange={(e) => submit(e.currentTarget)} className="flex items-center gap-2">
          {filter.client ? <input type="hidden" name="client" value={filter.client} /> : null}
          <input
            type="month"
            name="month"
            defaultValue={filter.month}
            className="input input-sm min-w-0 flex-1 lg:w-48 lg:flex-none"
          />
          {filter.month && (
            <Link to={filter.client ? `/?client=${filter.client}` : "/"} className="btn btn-sm btn-ghost">
              Clear
            </Link>
          )}
          <a
            href={`/export.csv?client=${filter.client || ""}&month=${filter.month}`}
            className="btn btn-sm btn-ghost"
            download
          >
            CSV
          </a>
        </Form>
      </div>

      <div className="hidden overflow-x-auto rounded-box bg-base-100 shadow-sm lg:block">
        <table className="table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Client</th>
              <th>Description</th>
              <th className="text-right">Time</th>
              <th className="w-12" />
            </tr>
          </thead>
          <tbody>
            {days
              .flatMap(([, es]) => es)
              .map((e) => (
                <tr key={e.id} className="hover:bg-base-200/50">
                  <td className="whitespace-nowrap">{dayLabel(e.entry_date)}</td>
                  <td className="whitespace-nowrap">{e.client_name}</td>
                  <td className="max-w-md wrap-break-words">{e.description}</td>
                  <td className="whitespace-nowrap text-right font-medium">{formatDuration(e.minutes)}</td>
                  <td>
                    <DeleteButton id={e.id} />
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {days.map(([date, entries]) => (
        <section key={date} className="space-y-2 lg:hidden">
          <h2 className="flex justify-between px-1 text-sm font-semibold opacity-70">
            <span>{dayLabel(date)}</span>
            <span>{formatDuration(entries.reduce((n, e) => n + e.minutes, 0))}</span>
          </h2>
          {entries.map((e) => (
            <div key={e.id} className="card bg-base-100 shadow-sm">
              <div className="card-body flex-row items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <p className="break-words font-medium">{e.description}</p>
                  <p className="text-sm opacity-60">{e.client_name}</p>
                </div>
                <span className="badge badge-primary badge-soft badge-lg whitespace-nowrap">
                  {formatDuration(e.minutes)}
                </span>
                <DeleteButton id={e.id} />
              </div>
            </div>
          ))}
        </section>
      ))}
      {!count && (
        <p className="py-10 text-center opacity-60 lg:rounded-box lg:bg-base-100">
          No entries yet. Tap “Log time” to add one.
        </p>
      )}
    </>
  );
}
