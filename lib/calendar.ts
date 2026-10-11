import { State } from "./model";
export function scheduleLabel(start: string, timezone: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: timezone,
    timeZoneName: "short",
  }).format(new Date(start));
}
export function parseSchedule(
  text: string,
  now = new Date(),
): { start?: string; question?: string } {
  const q = text.toLowerCase();
  const date = new Date(now);
  date.setSeconds(0, 0);
  if (/tomorrow/.test(q)) date.setDate(date.getDate() + 1);
  else if (!/tonight|today/.test(q)) {
    const iso = q.match(/\b(\d{4}-\d{2}-\d{2})\b/);
    const days = [
      "sunday",
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
    ];
    const day = days.findIndex((d) => q.includes(d));
    if (iso) {
      const [y, m, d] = iso[1].split("-").map(Number);
      date.setFullYear(y, m - 1, d);
      if (
        date.getFullYear() !== y ||
        date.getMonth() !== m - 1 ||
        date.getDate() !== d
      )
        return {
          question:
            "Which valid date should I use? For example, tomorrow at 6 pm.",
        };
    } else if (day >= 0) {
      date.setDate(date.getDate() + ((day - date.getDay() + 7) % 7 || 7));
    } else
      return {
        question: "Which day? For example, tonight, tomorrow, or Friday.",
      };
  }
  const words: Record<string, number> = {
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9,
    ten: 10,
    eleven: 11,
    twelve: 12,
    noon: 12,
    midnight: 0,
  };
  const match =
    q.match(/\bat\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/) ||
    q.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/) ||
    q.match(/\b(\d{1,2}):(\d{2})\b/);
  const word = q.match(
    /(?:at\s+)(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|noon|midnight)\b/,
  );
  if (!match && !word) return { question: "What time? For example, 6 pm." };
  let hour = match ? Number(match[1]) : words[word![1]];
  const minute = match ? Number(match[2] || 0) : 0;
  const meridiem =
    match?.[3] ||
    (/(?:\b|\d\s*)pm\b/.test(q)
      ? "pm"
      : /(?:\b|\d\s*)am\b/.test(q)
        ? "am"
        : undefined);
  if (hour > 23 || minute > 59 || (meridiem && (hour < 1 || hour > 12)))
    return { question: "What time should I use? Please include am or pm." };
  if (meridiem) hour = (hour % 12) + (meridiem === "pm" ? 12 : 0);
  else if (/tonight|evening/.test(q) && hour > 0 && hour < 12) hour += 12;
  else if (hour > 0 && hour < 12 && !/morning/.test(q))
    return {
      question: `Did you mean ${hour}:${String(minute).padStart(2, "0")} am or pm?`,
    };
  date.setHours(hour, minute, 0, 0);
  return { start: date.toISOString() };
}
const escapeIcs = (v: string) =>
  v
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
const stamp = (date: Date) =>
  date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
// Fold by UTF-8 bytes, not characters, so personal names with Unicode remain valid.
function fold(line: string) {
  const parts: string[] = [];
  let chunk = "";
  let bytes = 0;
  for (const char of line) {
    const count = new TextEncoder().encode(char).length;
    if (bytes + count > 73) {
      parts.push(chunk);
      chunk = " ";
      bytes = 1;
    }
    chunk += char;
    bytes += count;
  }
  parts.push(chunk);
  return parts.join("\r\n");
}
export function calendarFile(state: State, now = new Date()) {
  if (!state.schedule?.confirmed || !state.plan.length)
    throw new Error("Confirm a scheduled plan before exporting.");
  const stops = state.plan
    .map((s) => ({
      stop: s,
      place: state.places.find((p) => p.id === s.savedPlaceId),
    }))
    .filter((s) => s.place);
  const start = new Date(state.schedule.start);
  const end = new Date(
    start.getTime() +
      state.plan.reduce((sum, p) => sum + p.duration, 0) * 60000,
  );
  const description =
    stops
      .map(
        ({ stop, place }, i) =>
          `${i + 1}. ${place!.name}, ${place!.city} — ${stop.duration} min activity estimate`,
      )
      .join("\n") +
    "\nActivity time only; allow extra time for travel. Verify hours and availability. Created with Pinny.";
  // Only safe numeric characters enter UID, even if stored app IDs were modified.
  const planHash = Array.from(
    state.plan.map((p) => p.savedPlaceId).join("|"),
  ).reduce((hash, char) => (Math.imul(hash, 31) + char.charCodeAt(0)) >>> 0, 0);
  return (
    [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Pinny//Personal Outings//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "BEGIN:VEVENT",
      `UID:pinny-${start.getTime()}-${planHash}@pinny.local`,
      `DTSTAMP:${stamp(now)}`,
      `DTSTART:${stamp(start)}`,
      `DTEND:${stamp(end)}`,
      `SUMMARY:${escapeIcs(`Pinny: ${stops.map((s) => s.place!.name).join(" → ")}`)}`,
      `LOCATION:${escapeIcs(stops[0] ? `${stops[0].place!.name}, ${stops[0].place!.city}` : "")}`,
      `DESCRIPTION:${escapeIcs(description)}`,
      "END:VEVENT",
      "END:VCALENDAR",
    ]
      .map(fold)
      .join("\r\n") + "\r\n"
  );
}
