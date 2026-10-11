import { z } from "zod";
export const httpUrl = z
  .string()
  .max(2048)
  .url()
  .refine(
    (v) => ["http:", "https:"].includes(new URL(v).protocol),
    "Use an http or https URL",
  );
export const citationSchema = z.object({ url: httpUrl, title: z.string().max(200) });
export const webSchema = z.object({
  address: z.string().max(300),
  facts: z.string().max(1200),
  uncertainty: z.string().max(600),
  citations: z.array(citationSchema).min(1).max(6),
  researchedAt: z.string().datetime(),
  signature: z.string().max(128),
});
export const eventSchema = z.object({
  name: z.string().max(120),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  citations: z.array(citationSchema).min(1).max(6),
  normalEvening: z.boolean(),
  signature: z.string().max(128).optional(),
  verifiedAt: z.string().datetime().optional(),
});
export const placeSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(120),
  city: z.string().trim().min(1).max(120),
  category: z.string().max(80),
  neighborhood: z.string().max(120),
  inspirationLinks: z.array(httpUrl).max(20),
  whySaved: z.string().max(2000),
  tags: z.array(z.string().max(40)).max(20),
  budgetEstimate: z.number().min(0).max(10000).optional(),
  placeId: z.string().min(1).max(300).optional(),
  createdAt: z.string().datetime(),
  sample: z.boolean().optional(),
  web: webSchema.optional(),
});
export const visitSchema = z.object({
  id: z.string(),
  savedPlaceId: z.string(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine((v) => !Number.isNaN(Date.parse(v)), "Invalid date"),
  rating: z.number().int().min(1).max(5).optional(),
  note: z.string().max(2000),
});
export const settingsSchema = z.object({
  location: z.string().max(120),
  budget: z.number().min(0).max(10000).nullable(),
  context: z.enum(["solo", "group"]),
  availableTime: z.number().int().min(15).max(480),
});
export const stopSchema = z.object({
  savedPlaceId: z.string(),
  duration: z.number().int().min(5).max(180),
  explanation: z.string().max(1000),
});
export const messageSchema = z.object({
  id: z.string(),
  role: z.enum(["user", "assistant"]),
  text: z.string().max(4000),
  kind: z
    .enum(["text", "options", "plan", "schedule", "experience"])
    .default("text"),
  candidateIds: z.array(z.string()).max(3).optional(),
  savedPlaceId: z.string().optional(),
  citations: z.array(citationSchema).max(12).optional(),
  reasons: z.array(z.object({ id: z.string(), text: z.string().max(600) })).max(2).optional(),
});
export const scheduleSchema = z.object({
  start: z.string().datetime(),
  timezone: z
    .string()
    .max(100)
    .refine((value) => {
      try {
        new Intl.DateTimeFormat("en-US", { timeZone: value });
        return true;
      } catch {
        return false;
      }
    }, "Invalid timezone"),
  confirmed: z.boolean(),
});
export const contextSchema = z.object({
  candidateIds: z.array(z.string()).max(3).default([]),
  budgetExclusive: z.boolean().optional(),
  selectedId: z.string().optional(),
  lastQuery: z.string().max(2000).optional(),
  pendingQuery: z.string().max(2000).optional(),
  pendingSave: z.string().max(4000).optional(),
  pendingSchedule: z.string().max(2000).optional(),
  outingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});
export const stateSchema = z.object({
  version: z.literal(1),
  places: z.array(placeSchema).max(500),
  visits: z.array(visitSchema).max(3000),
  plan: z.array(stopSchema).max(5),
  settings: settingsSchema,
  messages: z.array(messageSchema).max(100).default([]),
  context: contextSchema.default({ candidateIds: [] }),
  schedule: scheduleSchema.nullable().default(null),
  research: z.array(placeSchema).max(12).default([]),
  preferences: z.array(z.string().max(300)).max(30).default([]),
  event: eventSchema.nullable().default(null),
});
export type SavedPlace = z.infer<typeof placeSchema>;
export type Visit = z.infer<typeof visitSchema>;
export type Settings = z.infer<typeof settingsSchema>;
export type PlanStop = z.infer<typeof stopSchema>;
export type State = z.infer<typeof stateSchema>;
export type Message = z.infer<typeof messageSchema>;
export type Mode = "demo" | "live";
export const defaultSettings: Settings = {
  location: "San Francisco",
  budget: 30,
  context: "solo",
  availableTime: 180,
};
export const emptyState = (): State => ({
  version: 1,
  places: [],
  visits: [],
  plan: [],
  settings: { ...defaultSettings, location: "", budget: null },
  messages: [],
  context: { candidateIds: [] },
  schedule: null,
  research: [],
  preferences: [],
  event: null,
});
export const availablePlaces = (state: State) => [...state.places, ...state.research.filter((p) => !state.places.some((saved) => saved.id === p.id))];
export const normalized = (v: string) =>
  v
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ");
export function duplicateOf(places: SavedPlace[], place: SavedPlace) {
  return places.find(
    (p) =>
      p.id !== place.id &&
      ((p.placeId && place.placeId && p.placeId === place.placeId) ||
        (normalized(p.name) === normalized(place.name) &&
          normalized(p.city) === normalized(place.city))),
  );
}
export function mapsUrl(place: SavedPlace, origin = "") {
  if (!place.placeId)
    return `https://www.google.com/maps/search/?${new URLSearchParams({ api: "1", query: `${place.name}, ${place.web?.address || place.city}` })}`;
  const params = new URLSearchParams({
    api: "1",
    destination: `${place.name}, ${place.web?.address || place.city}`,
    destination_place_id: place.placeId,
  });
  if (origin.trim()) params.set("origin", origin.trim());
  return `https://www.google.com/maps/dir/?${params}`;
}
export function directionsUrl(place: SavedPlace, origin = "") {
  const params = new URLSearchParams({
    api: "1",
    destination: `${place.name}, ${place.city}`,
  });
  if (place.placeId) params.set("destination_place_id", place.placeId);
  if (origin.trim()) params.set("origin", origin.trim());
  return `https://www.google.com/maps/dir/?${params}`;
}
