import { useState } from "react";
import { DayPicker } from "react-day-picker";
import { enGB } from "react-day-picker/locale";
import "react-day-picker/style.css";

const toIso = (d: Date) => d.toLocaleDateString("en-CA");
const fromIso = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return toIso(d);
};

export function DateField({ value, onChange }: { value: string; onChange: (iso: string) => void }) {
  const [open, setOpen] = useState(false);
  const selected = fromIso(value);
  const custom = value !== daysAgo(0) && value !== daysAgo(1);
  const label = custom
    ? selected.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })
    : "Select a date";

  return (
    <div className="mt-3">
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="opacity-60">Date</span>
        <div className="flex items-center gap-1">
          {[
            ["Today", 0],
            ["Yesterday", 1],
          ].map(([name, n]) => (
            <button
              key={name}
              type="button"
              onClick={() => {
                onChange(daysAgo(n as number));
                setOpen(false);
              }}
              className={`btn btn-sm ${value === daysAgo(n as number) ? "btn-primary" : "btn-soft"}`}
            >
              {name}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            className={`btn btn-sm ${open || custom ? "btn-primary" : "btn-soft"}`}
          >
            {label}
          </button>
        </div>
      </div>
      {open && (
        <div className="day-picker mt-2 flex justify-center rounded-box bg-base-200 p-2">
          <DayPicker
            mode="single"
            locale={enGB}
            weekStartsOn={1}
            selected={selected}
            defaultMonth={selected}
            disabled={{ after: new Date() }}
            onSelect={(d) => {
              if (!d) return;
              onChange(toIso(d));
              setOpen(false);
            }}
          />
        </div>
      )}
    </div>
  );
}
