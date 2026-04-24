const RELATIVE_TIME = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

const TIME_UNITS: { unit: Intl.RelativeTimeFormatUnit; ms: number }[] = [
  { unit: "year", ms: 365 * 24 * 60 * 60_000 },
  { unit: "month", ms: 30 * 24 * 60 * 60_000 },
  { unit: "day", ms: 24 * 60 * 60_000 },
  { unit: "hour", ms: 60 * 60_000 },
  { unit: "minute", ms: 60_000 },
  { unit: "second", ms: 1000 },
];

/**
 * Format a date as a relative-time string ("5 minutes ago"). Falls back to an
 * ISO date string for inputs older than a year so output stays readable.
 */
export function formatRelativeTime(value: Date | string): string {
  const date = typeof value === "string" ? new Date(value) : value;
  if (!Number.isFinite(date.getTime())) return "—";
  const deltaMs = date.getTime() - Date.now();
  const absMs = Math.abs(deltaMs);
  for (const { unit, ms } of TIME_UNITS) {
    if (absMs >= ms || unit === "second") {
      return RELATIVE_TIME.format(Math.round(deltaMs / ms), unit);
    }
  }
  return date.toISOString();
}

/**
 * Format a duration in milliseconds as a compact human-readable string,
 * e.g. `820ms`, `4.2s`, `1m 30s`.
 */
export function formatDuration(ms: number | null): string {
  if (ms == null || !Number.isFinite(ms) || ms < 0) return "—";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60_000);
  const seconds = Math.round((ms % 60_000) / 1000);
  return `${minutes}m ${seconds}s`;
}
