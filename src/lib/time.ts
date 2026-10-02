export const ICELAND_TZ = "Atlantic/Reykjavik";
export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;

const timeFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: ICELAND_TZ,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const dateFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: ICELAND_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const dayFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: ICELAND_TZ,
  weekday: "long",
  day: "numeric",
  month: "long",
});

const toDate = (t: string | number | Date) => (t instanceof Date ? t : new Date(t));

/** "22:40" in Iceland time, regardless of the viewer's own time zone. */
export function formatTime(t: string | number | Date): string {
  return timeFormat.format(toDate(t));
}

export function formatRange(start: string | number, end: string | number): string {
  return `${formatTime(start)}–${formatTime(end)}`;
}

/** YYYY-MM-DD in Iceland. */
export function icelandDate(t: string | number | Date): string {
  return dateFormat.format(toDate(t));
}

export function formatDay(t: string | number | Date): string {
  return dayFormat.format(toDate(t));
}

export function formatDuration(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest === 0 ? `${h} h` : `${h} h ${rest} min`;
}

/** "about 90 minutes", "roughly 2½ hours" — for prose. */
export function formatApproxDuration(minutes: number): string {
  if (minutes < 75) return `${Math.round(minutes / 15) * 15} minutes`;
  const halfHours = Math.round(minutes / 30) / 2;
  const whole = Math.floor(halfHours);
  const text = halfHours % 1 === 0 ? `${whole}` : `${whole}½`;
  return `${text} hours`;
}

export function formatRelative(target: string | number, reference: string | number): string {
  const diff = Math.round((toDate(target).getTime() - toDate(reference).getTime()) / MINUTE);
  if (Math.abs(diff) < 1) return "just now";
  const text = formatDuration(Math.abs(diff));
  return diff > 0 ? `in ${text}` : `${text} ago`;
}

export function utcHourOfDay(t: number): number {
  const d = new Date(t);
  return d.getUTCHours() + d.getUTCMinutes() / 60;
}

export function isWinterSeason(t: number): boolean {
  const month = new Date(t).getUTCMonth();
  return month >= 9 || month <= 3;
}
