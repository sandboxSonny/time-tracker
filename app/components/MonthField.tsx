import { useRef, useState } from "react";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const currentMonth = () => new Date().toLocaleDateString("en-CA").slice(0, 7);

const chevron = (d: string) => (
  <svg
    viewBox="0 0 24 24"
    className="size-5"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d={d} />
  </svg>
);

export function MonthField({ value, onChange }: { value: string; onChange: (month: string) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const now = currentMonth();
  const [year, setYear] = useState(Number((value || now).slice(0, 4)));
  // Raw text while typing; `year` only updates once it is a complete 4-digit year
  const [draft, setDraft] = useState(String(year));
  const changeYear = (y: number) => {
    setYear(y);
    setDraft(String(y));
  };
  const label = value
    ? new Date(`${value}-01T00:00:00Z`).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" })
    : "All time";

  const pick = (month: string) => {
    dialog.current?.close();
    onChange(month);
  };

  return (
    <>
      <button
        type="button"
        className={`btn btn-sm min-w-0 flex-1 justify-between lg:w-48 lg:flex-none ${value ? "btn-neutral" : "btn-soft"}`}
        onClick={() => {
          changeYear(Number((value || now).slice(0, 4)));
          dialog.current?.showModal();
        }}
      >
        <span className="truncate">{label}</span>
        {chevron("M6 9l6 6 6-6")}
      </button>

      <dialog ref={dialog} className="modal modal-bottom lg:modal-middle">
        <div
          className="modal-box w-full max-w-sm justify-self-center rounded-t-3xl p-5 lg:rounded-2xl"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1.25rem)" }}
        >
          <div className="mb-3 flex items-center justify-between">
            <button
              type="button"
              className="btn btn-ghost btn-circle"
              onClick={() => changeYear(year - 1)}
              aria-label="Previous year"
            >
              {chevron("M15 18l-6-6 6-6")}
            </button>
            <input
              type="text"
              inputMode="numeric"
              maxLength={4}
              value={draft}
              aria-label="Year"
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, "");
                setDraft(v);
                if (v.length === 4) setYear(Number(v));
              }}
              onFocus={(e) => e.target.select()}
              onBlur={() => setDraft(String(year))}
              className="input input-ghost w-24 text-center text-lg font-semibold"
            />
            <button
              type="button"
              className="btn btn-ghost btn-circle"
              onClick={() => changeYear(year + 1)}
              aria-label="Next year"
            >
              {chevron("M9 18l6-6-6-6")}
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {MONTHS.map((m, i) => {
              const iso = `${year}-${String(i + 1).padStart(2, "0")}`;
              return (
                <button
                  key={iso}
                  type="button"
                  onClick={() => pick(iso)}
                  className={`btn btn-lg lg:btn-md ${iso === value ? "btn-primary" : iso === now ? "btn-soft btn-primary" : "btn-soft"}`}
                >
                  {m}
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex gap-2">
            <button type="button" className="btn btn-ghost flex-1" onClick={() => pick(now)}>
              This month
            </button>
            {value && (
              <button type="button" className="btn btn-ghost flex-1" onClick={() => pick("")}>
                All time
              </button>
            )}
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
