import { z } from "zod";
import { State, Message, availablePlaces, citationSchema, eventSchema, placeSchema, settingsSchema, scheduleSchema, duplicateOf, stateSchema } from "./model";
import { newId } from "./conversation";

export const intentSchema = z.object({
  research: z.boolean(),
  researchQuery: z.string().max(1600),
  locationNeeded: z.boolean(),
  question: z.string().max(300).nullable(),
});
const ref = z.string().min(1).max(150);
const sourceIds = z.array(z.number().int().min(0)).max(6);
export const actionSchema = z.object({
  reply: z.string().min(1).max(3000),
  kind: z.enum(["reply", "recommend", "plan", "schedule", "save", "visit", "preference"]),
  options: z.array(z.object({ id: ref, reason: z.string().max(600) })).max(2),
  stops: z.array(z.object({ id: ref, duration: z.number().int().min(5).max(180), reason: z.string().max(600) })).max(5),
  discovered: z.array(z.object({ ref, name: z.string().min(1).max(120), city: z.string().min(1).max(120), category: z.enum(["Food", "Coffee", "Walk", "Other"]), address: z.string().max(300), facts: z.string().max(1200), uncertainty: z.string().max(600), sourceIds })).max(5),
  sourceIds,
  settings: settingsSchema.nullable(),
  schedule: z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), time: z.string().regex(/^\d{2}:\d{2}$/) }).nullable(),
  outingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  save: z.object({ name: z.string().min(1).max(120), city: z.string().min(1).max(120), whySaved: z.string().max(2000), category: z.string().max(80), tags: z.array(z.string().max(40)).max(20), userBudget: z.number().min(0).max(10000).nullable() }).nullable(),
  visit: z.object({ placeId: ref, note: z.string().max(2000) }).nullable(),
  preference: z.string().min(1).max(300).nullable(),
  event: z.object({ name: z.string().max(120), startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), sourceIds }).nullable(),
  eventChoice: z.enum(["keep", "event", "normal"]),
});
export type ModelAction = z.infer<typeof actionSchema>;
export const liveResultSchema = z.object({
  reply: z.string().max(3000), kind: actionSchema.shape.kind,
  candidates: z.array(placeSchema).max(5),
  optionIds: z.array(ref).max(2),
  reasons: z.array(z.object({ id: ref, text: z.string().max(600) })).max(2).default([]),
  stops: z.array(z.object({ id: ref, duration: z.number().int().min(5).max(180), reason: z.string().max(600) })).max(5),
  settings: settingsSchema.nullable(), schedule: scheduleSchema.nullable(),
  save: placeSchema.nullable(),
  visit: z.object({ placeId: ref, note: z.string().max(2000), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).nullable(),
  preference: z.string().max(300).nullable(),
  event: eventSchema.nullable(),
  citations: z.array(citationSchema).max(12),
  researched: z.boolean(),
  outingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().default(null),
});
export type LiveResult = z.infer<typeof liveResultSchema>;
export function applyLiveResult(current: State, text: string, input: unknown): State {
  const result = liveResultSchema.parse(input);
  const next = structuredClone(current);
  const candidates = availablePlaces(next);
  const existingIds = new Set(candidates.map((p) => p.id));
  for (const p of result.candidates) {
    const existing = candidates.find((old) => old.id === p.id);
    if (p.sample || !p.web || (existing && (existing.name !== p.name || existing.city !== p.city))) throw new Error("Invalid live candidate.");
    if (existing) {
      const saved = next.places.find((old) => old.id === p.id);
      if (saved) saved.web = p.web;
    }
    existingIds.add(p.id);
  }
  if ([...result.optionIds, ...result.stops.map((s) => s.id), ...(result.visit ? [result.visit.placeId] : [])].some((id) => !existingIds.has(id)))
    throw new Error("The agent referenced an unknown place; no changes were applied.");
  if (new Set(result.stops.map((s) => s.id)).size !== result.stops.length) throw new Error("Duplicate plan stop.");
  if (result.settings) next.settings = result.settings;
  if (result.stops.reduce((sum, s) => sum + s.duration, 0) > next.settings.availableTime) throw new Error("The activity plan exceeds your available time.");
  next.research = [...result.candidates.filter((p) => !next.places.some((saved) => saved.id === p.id)), ...next.research.filter((p) => !result.candidates.some((incoming) => incoming.id === p.id))].slice(0, 12);
  if (result.kind === "plan") {
    next.plan = result.stops.map((s) => ({ savedPlaceId: s.id, duration: s.duration, explanation: s.reason }));
    for (const stop of next.plan) {
      if (!next.places.some((p) => p.id === stop.savedPlaceId)) {
        const place = [...candidates, ...result.candidates].find((p) => p.id === stop.savedPlaceId)!;
        next.places.push({ ...place, whySaved: "Chosen for my outing plan." });
      }
    }
    next.schedule = next.schedule ? { ...next.schedule, confirmed: false } : null;
    next.context.selectedId = next.plan[0]?.savedPlaceId;
  }
  if (result.kind === "recommend") next.context.candidateIds = result.optionIds;
  if (result.schedule) {
    if (!next.plan.length) throw new Error("Choose a plan before scheduling it.");
    next.schedule = { ...result.schedule, confirmed: false };
  }
  if (result.save) {
    const match = duplicateOf(next.places, result.save);
    if (match) {
      // AI cannot overwrite or truncate an existing record; the established
      // explicit merge flow remains available in saved-only mode.
      throw new Error("This place is already saved. Your original data was kept.");
    }
    next.places.push(result.save);
    next.context.selectedId = result.save.id;
  }
  if (result.visit) {
    const place = availablePlaces(next).find((p) => p.id === result.visit!.placeId)!;
    if (!next.places.some((p) => p.id === place.id)) next.places.push({ ...place, whySaved: "Visited personally." });
    next.visits.push({ id: newId(), savedPlaceId: place.id, date: result.visit.date, note: result.visit.note });
    next.context.selectedId = place.id;
  }
  if (result.preference && !next.preferences.includes(result.preference)) next.preferences.push(result.preference);
  next.event = result.event;
  if (result.outingDate) next.context.outingDate = result.outingDate;
  const kind: Message["kind"] = result.kind === "recommend" ? "options" : result.kind === "schedule" ? "schedule" : result.kind === "plan" ? "plan" : result.kind === "visit" ? "experience" : "text";
  next.messages = [...next.messages, { id: newId(), role: "user" as const, text, kind: "text" as const }, { id: newId(), role: "assistant" as const, text: result.reply, kind, candidateIds: result.kind === "recommend" ? result.optionIds : undefined, citations: result.citations, reasons: result.reasons }].slice(-100);
  next.context.lastQuery = text;
  return stateSchema.parse(next);
}

export function localDate(instant: string, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(instant));
  const part = (name: string) => parts.find((p) => p.type === name)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}
export function zonedTime(date: string, time: string, timezone: string): string {
  if (!validDate(date) || Number(time.slice(0,2)) > 23 || Number(time.slice(3)) > 59) throw new Error("Invalid calendar date or time.");
  const target = Date.parse(`${date}T${time}:00Z`);
  if (!Number.isFinite(target)) throw new Error("Invalid calendar date.");
  const formatter = new Intl.DateTimeFormat("en-GB", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  let guess = target;
  for (let i = 0; i < 3; i++) {
    const parts = formatter.formatToParts(new Date(guess));
    const p = (name: string) => parts.find((v) => v.type === name)!.value;
    const shown = `${p("year")}-${p("month")}-${p("day")}T${p("hour")}:${p("minute")}:00Z`;
    const delta = target - Date.parse(shown);
    if (!delta) return new Date(guess).toISOString();
    guess += delta;
  }
  throw new Error("That local time does not exist in your timezone. Choose another time.");
}
export function validDate(date: string) {
  const value = new Date(`${date}T00:00:00Z`);
  return Number.isFinite(value.getTime()) && value.toISOString().slice(0,10) === date;
}
