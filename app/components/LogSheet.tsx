import { Fragment, useEffect, useRef, useState } from "react";
import { Link, useFetcher } from "react-router";
import { DateField } from "~/components/DateField";
import { formatDuration, parseDuration } from "~/time";

type ClientOption = { id: number; name: string };

const QUICK = ["15m", "30m", "45m", "1h", "1h30m", "2h", "3h", "4h"];
const TITLES = ["Which client?", "Where was the job?", "What was it for?", "How long?"];
const localToday = () => new Date().toLocaleDateString("en-CA");

export function LogSheet({
  clients,
  recent,
  locations,
}: {
  clients: ClientOption[];
  recent: number[];
  locations: string[];
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const locRef = useRef<HTMLInputElement>(null);
  const descRef = useRef<HTMLInputElement>(null);
  const durRef = useRef<HTMLInputElement>(null);
  const fetcher = useFetcher<{ ok?: boolean; error?: string }>();

  const [step, setStep] = useState(0);
  const [clientId, setClientId] = useState<number | null>(null);
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [duration, setDuration] = useState("");
  const [date, setDate] = useState(localToday);
  // Result object already shown (or discarded on reopen), so a stale error is not displayed again
  const [dismissed, setDismissed] = useState<unknown>(null);
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);

  const minutes = parseDuration(duration);
  const client = clients.find((c) => c.id === clientId);
  const checks = [!!client, true, description.trim().length > 0, !!minutes && !!date];
  const last = TITLES.length - 1;
  const locQuery = location.trim().toLowerCase();
  const locOptions = locations.filter((l) => l.toLowerCase().includes(locQuery) && l.toLowerCase() !== locQuery);
  const valid = checks[step];
  const searching = query.trim() !== "";
  const recentClients = recent.flatMap((id) => clients.find((c) => c.id === id) ?? []);
  const ordered = [...recentClients, ...clients.filter((c) => !recent.includes(c.id))];
  const hasMore = clients.length > recentClients.length;
  const showSections = !searching && recentClients.length > 0 && hasMore;
  const collapsed = showSections && !showAll;
  const shownClients = searching
    ? clients.filter((c) => c.name.toLowerCase().includes(query.trim().toLowerCase()))
    : collapsed
      ? recentClients
      : ordered;
  const error = fetcher.data !== dismissed ? (fetcher.data?.error ?? "") : "";
  const saving = fetcher.state !== "idle";

  function open() {
    setStep(0);
    setLocation("");
    setDescription("");
    setDuration("");
    setDate(localToday());
    setDismissed(fetcher.data);
    setQuery("");
    setShowAll(false);
    dialog.current?.showModal();
  }

  useEffect(() => {
    if (fetcher.state !== "idle" || !fetcher.data) return;
    if (fetcher.data.ok) dialog.current?.close();
  }, [fetcher.state, fetcher.data]);

  // Focus the field once the slide animation has finished (focusing mid-slide makes the browser scroll the track).
  useEffect(() => {
    if (!dialog.current?.open) return;
    const t = setTimeout(() => [null, locRef.current, descRef.current, durRef.current][step]?.focus(), 320);
    return () => clearTimeout(t);
  }, [step]);

  const pane = (i: number) => ({ className: "w-1/4 shrink-0 px-5 pb-2", inert: step !== i });

  return (
    <>
      <button
        type="button"
        onClick={open}
        className="btn btn-primary btn-lg fixed right-4 bottom-[calc(env(safe-area-inset-bottom)+5rem)] z-20 rounded-full shadow-xl lg:right-8 lg:bottom-8"
      >
        <svg
          viewBox="0 0 24 24"
          className="size-6"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
        >
          <path d="M12 5v14M5 12h14" />
        </svg>
        Log time
      </button>

      <dialog ref={dialog} className="modal modal-bottom lg:modal-middle">
        <fetcher.Form
          method="post"
          action="/?index"
          className="modal-box w-full max-w-lg justify-self-center overflow-hidden rounded-t-3xl p-0 lg:rounded-2xl"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
          onSubmit={(e) => {
            if (step < last || !valid) {
              e.preventDefault();
              if (valid) setStep(step + 1);
            }
          }}
        >
          <input type="hidden" name="intent" value="add" />
          <input type="hidden" name="client" value={clientId ?? ""} />
          <input type="hidden" name="location" value={location} />
          <input type="hidden" name="description" value={description} />
          <input type="hidden" name="duration" value={duration} />
          <input type="hidden" name="date" value={date} />

          <div className="flex items-center gap-2 px-3 pt-3">
            <button
              type="button"
              className={`btn btn-ghost btn-circle btn-sm ${step === 0 ? "invisible" : ""}`}
              onClick={() => setStep(step - 1)}
              aria-label="Back"
            >
              <svg
                viewBox="0 0 24 24"
                className="size-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
            <h2 className="flex-1 text-center text-lg font-semibold">{TITLES[step]}</h2>
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

          <div className="flex gap-1.5 px-5 py-3" aria-hidden>
            {TITLES.map((_, i) => (
              <div
                key={i}
                className={`h-1 flex-1 rounded-full transition-colors duration-300 ${i <= step ? "bg-primary" : "bg-base-300"}`}
              />
            ))}
          </div>

          <div className="overflow-hidden">
            <div
              className="flex items-start transition-transform duration-300 ease-out"
              style={{ width: "400%", transform: `translateX(-${(step * 100) / 4}%)` }}
            >
              <div {...pane(0)}>
                {clients.length > 4 && (
                  <input
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={`Search ${clients.length} clients`}
                    className="input mb-3 w-full"
                  />
                )}
                {clients.length ? (
                  <div className="flex max-h-[45vh] flex-col gap-2 overflow-y-auto lg:grid lg:max-h-72 lg:grid-cols-2">
                    {shownClients.map((c, i) => (
                      <Fragment key={c.id}>
                        {showSections && i === 0 && (
                          <p className="px-1 text-xs font-semibold uppercase opacity-50">Recent</p>
                        )}
                        {showSections && showAll && i === recentClients.length && (
                          <p className="mt-2 px-1 text-xs font-semibold uppercase opacity-50">All clients</p>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setClientId(c.id);
                            setStep(1);
                          }}
                          className={`btn btn-lg justify-start ${c.id === clientId ? "btn-primary" : "btn-soft"}`}
                        >
                          {c.name}
                        </button>
                      </Fragment>
                    ))}
                    {collapsed && (
                      <button type="button" className="btn btn-ghost mt-1" onClick={() => setShowAll(true)}>
                        Show all {clients.length} clients
                      </button>
                    )}
                    {!shownClients.length && <p className="py-6 text-center text-sm opacity-60">No clients match.</p>}
                  </div>
                ) : (
                  <p className="py-6 text-center">
                    No clients yet.{" "}
                    <Link to="/clients" className="link link-primary" onClick={() => dialog.current?.close()}>
                      Add one
                    </Link>
                  </p>
                )}
              </div>

              <div {...pane(1)}>
                <p className="mb-2 text-sm opacity-60">{client?.name}</p>
                <input
                  ref={locRef}
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  maxLength={60}
                  enterKeyHint="next"
                  placeholder="e.g. Skipton"
                  className="input input-lg w-full"
                />
                {locOptions.length > 0 && (
                  <div className="mt-3 flex max-h-40 flex-wrap gap-2 overflow-y-auto">
                    {locOptions.map((l) => (
                      <button
                        key={l}
                        type="button"
                        onClick={() => {
                          setLocation(l);
                          setStep(2);
                        }}
                        className="btn btn-soft"
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div {...pane(2)}>
                <p className="mb-2 text-sm opacity-60">{[client?.name, location.trim()].filter(Boolean).join(" · ")}</p>
                <input
                  ref={descRef}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={200}
                  enterKeyHint="next"
                  placeholder="e.g. Replaced boiler pressure valve"
                  className="input input-lg w-full"
                />
              </div>

              <div {...pane(3)}>
                <div className="grid grid-cols-4 gap-2">
                  {QUICK.map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => setDuration(q)}
                      className={`btn ${duration === q ? "btn-primary" : "btn-soft"}`}
                    >
                      {q}
                    </button>
                  ))}
                </div>
                <input
                  ref={durRef}
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  enterKeyHint="done"
                  placeholder="Or type: 1h20m, 1:30, 1.5"
                  className="input mt-3 w-full"
                />
                <DateField value={date} onChange={setDate} />
                {error && <p className="mt-2 text-sm text-error">{error}</p>}
              </div>
            </div>
          </div>

          <div className="px-5 pb-5 pt-2">
            <button type="submit" className="btn btn-primary btn-lg w-full" disabled={!valid || saving}>
              {saving ? (
                <span className="loading loading-spinner" />
              ) : step < last ? (
                step === 1 && !location.trim() ? (
                  "Skip"
                ) : (
                  "Next"
                )
              ) : (
                `Log ${minutes ? formatDuration(minutes) : "time"}`
              )}
            </button>
          </div>
        </fetcher.Form>
        <div className="modal-backdrop">
          <button type="button" onClick={() => dialog.current?.close()}>
            close
          </button>
        </div>
      </dialog>
    </>
  );
}
