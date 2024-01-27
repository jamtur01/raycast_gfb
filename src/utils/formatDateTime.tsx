export function formatDateTime(utcDateTime: Date) {
  const dateOptions: Intl.DateTimeFormatOptions = { year: "2-digit", month: "2-digit", day: "2-digit" };
  const timeOptions: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit", hour12: true };

  const formattedDate = utcDateTime.toLocaleDateString("en-US", dateOptions);
  const easternTime = new Intl.DateTimeFormat("en-US", { ...timeOptions, timeZone: "America/New_York" }).format(
    utcDateTime,
  );

  return `${formattedDate} at ${easternTime}`;
}
