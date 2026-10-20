/** Parses "1.5", "1:30", "90m", "1h", "1h30m" into whole minutes. Returns null if invalid. */
export function parseDuration(input: string): number | null {
  const s = input.trim().toLowerCase().replace(/\s+/g, "");
  let m: RegExpMatchArray | null;
  let minutes: number;
  if ((m = s.match(/^(\d+):(\d{1,2})$/))) minutes = +m[1] * 60 + +m[2];
  else if ((m = s.match(/^(?:(\d+(?:\.\d+)?)h)?(?:(\d+)m(?:in)?s?)?$/)) && s !== "" && (m[1] || m[2]))
    minutes = Math.round(+(m[1] ?? 0) * 60 + +(m[2] ?? 0));
  else if ((m = s.match(/^\d+(?:\.\d+)?$/))) minutes = Math.round(parseFloat(s) * 60);
  else return null;
  return minutes > 0 && minutes <= 24 * 60 ? minutes : null;
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? (m ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
}
