/** Archived windows always use their saved timezone, independent of the device's locale zone. */
export function formatFinancialDateTime(value: string, timeZone?: string, locale?: string) {
  return new Date(value).toLocaleString(locale, {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
