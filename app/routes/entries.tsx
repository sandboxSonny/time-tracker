import { useEffect, useRef, useState } from "react";
import { Form, Link, useNavigate } from "react-router";
import type { Route } from "./+types/entries";
import { MonthField } from "~/components/MonthField";
import { addEntry, deleteEntry, listClients, listEntries, listLocations } from "~/db.server";
import { requireAuth } from "~/session.server";
import { formatDuration, parseDuration } from "~/time";

export async function loader({ request }: Route.LoaderArgs) {
  await requireAuth(request);
  const url = new URL(request.url);
  const clientId = Number(url.searchParams.get("client")) || undefined;
  const month = /^\d{4}-\d{2}$/.test(url.searchParams.get("month") ?? "") ? url.searchParams.get("month")! : undefined;
  const location = url.searchParams.get("location")?.trim() || undefined;
  const entries = listEntries({ clientId, month, location });
  const totals = new Map<string, number>();
  const days = new Map<string, typeof entries>();
  for (const e of entries) {
    totals.set(e.client_name, (totals.get(e.client_name) ?? 0) + e.minutes);
    days.set(e.entry_date, [...(days.get(e.entry_date) ?? []), e]);
  }
  return {
    clients: listClients(true),
    locations: listLocations(),
    days: [...days],
    totals: [...totals],
    total: entries.reduce((n, e) => n + e.minutes, 0),
    count: entries.length,
    filter: { client: clientId ?? 0, month: month ?? "", location: location ?? "" },
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
  const location = String(form.get("location") ?? "")
    .trim()
    .slice(0, 60);
  const minutes = parseDuration(String(form.get("duration") ?? ""));
  if (!clientId) return { error: "Choose a client." };
  const parsed = new Date(`${date}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || isNaN(+parsed) || parsed.toISOString().slice(0, 10) !== date) {
    return { error: "Enter a valid date." };
  }
  if (!description) return { error: "Add a short description." };
  if (!minutes) return { error: "Duration not recognised. Try 1.5, 1:30, 90m or 1h30m." };
  addEntry({ clientId, date, description, location, minutes });
  return { ok: true };
}

const dayLabel = (d: string) =>
  new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });

type FilterOption = { id: string; name: string; archived?: number };

function DesktopOptionFilter({
  options,
  current,
  href,
  noun,
}: {
  options: FilterOption[];
  current: string;
  href: (id: string) => string;
  noun: string;
}) {
  const navigate = useNavigate();
  const root = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = options.find((c) => c.id === current);
  const q = query.trim().toLowerCase();
  const shown = options.filter((c) => c.name.toLowerCase().includes(q));
  const showAll = !q;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const pick = (id: string) => {
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
        <span className="truncate">{selected?.name ?? `All ${noun}s`}</span>
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
                else if (showAll) pick("");
              }
            }}
            placeholder={`Search ${options.length} ${noun}s`}
            className="input input-sm w-full"
          />
          <ul className="menu max-h-72 flex-nowrap overflow-y-auto p-0" role="listbox">
            {showAll && (
              <li>
                <button type="button" className={current === "" ? "menu-active" : ""} onClick={() => pick("")}>
                  All {noun}s
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
                <span>No {noun}s match.</span>
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

const closeIcon = (
  <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);

type MobileSection = {
  key: string;
  noun: string;
  options: FilterOption[];
  current: string;
  href: (id: string) => string;
};

function MobileFilters({
  sections,
  month,
  onMonth,
  active,
  clearHref,
}: {
  sections: MobileSection[];
  month: string;
  onMonth: (month: string) => void;
  active: number;
  clearHref: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [view, setView] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const section = sections.find((x) => x.key === view);
  const shown = section?.options.filter((o) => o.name.toLowerCase().includes(query.trim().toLowerCase())) ?? [];
  const close = () => dialog.current?.close();

  return (
    <>
      <button
        type="button"
        className={`btn btn-sm gap-1 lg:hidden ${active ? "btn-neutral" : "btn-soft"}`}
        onClick={() => {
          setView(null);
          setQuery("");
          dialog.current?.showModal();
        }}
      >
        <svg
          viewBox="0 0 24 24"
          className="size-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
        >
          <path d="M3 5h18M6 12h12M10 19h4" />
        </svg>
        Filters
        {active > 0 && <span className="badge badge-sm badge-primary">{active}</span>}
      </button>

      <dialog ref={dialog} className="modal modal-bottom lg:hidden">
        <div
          className="modal-box flex max-h-[80vh] w-full max-w-lg flex-col gap-3 justify-self-center rounded-t-3xl p-5"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1.25rem)" }}
        >
          <div className="flex items-center justify-between gap-2">
            {section ? (
              <button type="button" className="btn btn-ghost btn-sm -ml-2" onClick={() => setView(null)}>
                ‹ Back
              </button>
            ) : (
              <h2 className="text-lg font-semibold">Filters</h2>
            )}
            {section && <h2 className="text-lg font-semibold capitalize">{section.noun}</h2>}
            <button type="button" className="btn btn-ghost btn-circle btn-sm" onClick={close} aria-label="Close">
              {closeIcon}
            </button>
          </div>

          {section ? (
            <>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`Search ${section.options.length} ${section.noun}s`}
                className="input w-full"
              />
              <div className="flex flex-col gap-1 overflow-y-auto">
                {!query && (
                  <Link
                    to={section.href("")}
                    onClick={close}
                    className={`btn justify-start ${section.current === "" ? "btn-primary" : "btn-ghost"}`}
                  >
                    All {section.noun}s
                  </Link>
                )}
                {shown.map((o) => (
                  <Link
                    key={o.id}
                    to={section.href(o.id)}
                    onClick={close}
                    className={`btn justify-start ${o.id === section.current ? "btn-primary" : "btn-ghost"}`}
                  >
                    <span className="truncate">{o.name}</span>
                    {o.archived ? <span className="badge badge-ghost badge-sm">archived</span> : null}
                  </Link>
                ))}
                {!shown.length && <p className="py-6 text-center text-sm opacity-60">No {section.noun}s match.</p>}
              </div>
            </>
          ) : (
            <div className="flex flex-col gap-2">
              {sections.map((x) => {
                const name = x.options.find((o) => o.id === x.current)?.name;
                return (
                  <button
                    key={x.key}
                    type="button"
                    className={`btn justify-between ${name ? "btn-neutral" : "btn-soft"}`}
                    onClick={() => {
                      setQuery("");
                      setView(x.key);
                    }}
                  >
                    <span className="capitalize">{x.noun}</span>
                    <span className="truncate font-normal">{name ?? `All ${x.noun}s`} ›</span>
                  </button>
                );
              })}
              <div className="flex">
                <MonthField
                  value={month}
                  onChange={(m) => {
                    close();
                    onMonth(m);
                  }}
                />
              </div>
              {active > 0 && (
                <Link to={clearHref} onClick={close} className="btn btn-ghost btn-sm mt-1">
                  Clear all filters
                </Link>
              )}
            </div>
          )}
        </div>
        <div className="modal-backdrop">
          <button type="button" onClick={close}>
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
  const { clients, locations, days, totals, total, count, filter } = loaderData;
  const navigate = useNavigate();
  const query = (f: { client?: number; month?: string; location?: string }) => {
    const p = new URLSearchParams();
    if (f.client) p.set("client", String(f.client));
    if (f.month) p.set("month", f.month);
    if (f.location) p.set("location", f.location);
    return `/?${p}`;
  };
  const chip = (id: number) => query({ ...filter, client: id });

  const sections: MobileSection[] = [
    {
      key: "client",
      noun: "client",
      options: clients.map((c) => ({ ...c, id: String(c.id) })),
      current: filter.client ? String(filter.client) : "",
      href: (id) => chip(Number(id)),
    },
    ...(locations.length > 0 || filter.location
      ? [
          {
            key: "location",
            noun: "location",
            options: [...new Set([...locations, ...(filter.location ? [filter.location] : [])])].map((l) => ({
              id: l,
              name: l,
            })),
            current: filter.location,
            href: (location: string) => query({ ...filter, location }),
          },
        ]
      : []),
  ];

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
        <MobileFilters
          sections={sections}
          month={filter.month}
          onMonth={(month) => navigate(query({ ...filter, month }))}
          active={[filter.client, filter.location, filter.month].filter(Boolean).length}
          clearHref="/"
        />
        {sections.map((x) => (
          <DesktopOptionFilter key={x.key} options={x.options} current={x.current} href={x.href} noun={x.noun} />
        ))}
        <Form method="get" className="flex min-w-0 flex-1 items-center gap-2">
          <div className="hidden min-w-0 lg:block">
            <MonthField value={filter.month} onChange={(month) => navigate(query({ ...filter, month }))} />
          </div>
          {filter.month && (
            <Link to={query({ ...filter, month: "" })} className="btn btn-sm btn-ghost hidden lg:inline-flex">
              Clear
            </Link>
          )}
          <a
            href={`/export.csv?${new URLSearchParams({ client: String(filter.client || ""), month: filter.month, location: filter.location })}`}
            className="btn btn-sm btn-ghost ml-auto lg:ml-0"
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
              <th>Location</th>
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
                  <td className="whitespace-nowrap">{e.location}</td>
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
                  <p className="break-words font-medium">{e.client_name}</p>
                  <p className="text-sm opacity-60">{[e.location, e.description].filter(Boolean).join(" · ")}</p>
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
