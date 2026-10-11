import { z } from "zod";
import { State, stateSchema, normalized } from "./model";
import { newId } from "./conversation";

export const MAX_BACKUP_BYTES = 2 * 1024 * 1024;
const dataSchema = stateSchema.pick({
  places: true, visits: true, plan: true, settings: true, schedule: true,
});
const backupSchema = z.object({
  format: z.literal("pinny-personal-backup"),
  version: z.literal(1),
  data: dataSchema,
}).strict();
export type PersonalBackup = z.infer<typeof backupSchema>;

export function readBackup(text: string): PersonalBackup {
  if (new TextEncoder().encode(text).length > MAX_BACKUP_BYTES)
    throw new Error("Choose a Pinny JSON backup smaller than 2 MB.");
  const result = backupSchema.safeParse(JSON.parse(text));
  if (!result.success) throw new Error("This file is not a valid Pinny personal backup.");
  const data = result.data.data;
  if (data.places.some((p) => p.sample))
    throw new Error("Sample places cannot be imported into your personal workspace.");
  const ids = new Set(data.places.map((p) => p.id));
  if (ids.size !== data.places.length || data.plan.some((s) => !ids.has(s.savedPlaceId)))
    throw new Error("The backup has duplicate place IDs or an invalid plan reference.");
  return result.data;
}

export function writeBackup(state: State): string {
  const data = dataSchema.parse(state);
  if (data.places.some((p) => p.sample))
    throw new Error("Switch to your personal workspace to export your own data.");
  return JSON.stringify({ format: "pinny-personal-backup", version: 1, data }, null, 2);
}

// Merge atomically: keep current notes, history and plan; map imported references
// to matched places. No raw provider enrichment or conversation is transferred.
export function mergeBackup(current: State, backup: PersonalBackup): State {
  const incoming = readBackup(JSON.stringify(backup)).data;
  const next = structuredClone(current);
  const wasEmpty = !current.places.length && !current.visits.length && !current.plan.length;
  const mapping = new Map<string, string>();
  const usedIds = new Set(next.places.map((p) => p.id));
  for (const place of incoming.places) {
    const match = next.places.find((p) =>
      (p.placeId && place.placeId && p.placeId === place.placeId) ||
      (normalized(p.name) === normalized(place.name) && normalized(p.city) === normalized(place.city)),
    );
    if (match) {
      mapping.set(place.id, match.id);
      const links = [...new Set([...match.inspirationLinks, ...place.inspirationLinks])];
      const tags = [...new Set([...match.tags, ...place.tags])];
      const note = !place.whySaved || match.whySaved.includes(place.whySaved)
        ? match.whySaved : [match.whySaved, place.whySaved].filter(Boolean).join("\n");
      if (links.length > 20 || tags.length > 20 || note.length > 2000)
        throw new Error("A merged place exceeds Pinny's note/link limit. Nothing was imported.");
      match.inspirationLinks = links;
      match.tags = tags;
      match.whySaved = note;
      match.budgetEstimate ??= place.budgetEstimate;
      match.placeId ??= place.placeId;
    } else {
      let id = place.id;
      while (usedIds.has(id)) id = newId();
      usedIds.add(id);
      mapping.set(place.id, id);
      next.places.push({ ...place, id });
    }
  }
  for (const visit of incoming.visits) {
    // Legacy orphan memories remain orphaned, never attached to an unrelated place.
    const savedPlaceId = mapping.get(visit.savedPlaceId) || `imported-orphan:${visit.savedPlaceId}`;
    if (!next.visits.some((v) => v.savedPlaceId === savedPlaceId && v.date === visit.date && v.note === visit.note && v.rating === visit.rating))
      next.visits.push({ ...visit, savedPlaceId, id: newId() });
  }
  if (!next.plan.length && incoming.plan.length) {
    next.plan = incoming.plan.map((s) => ({ ...s, savedPlaceId: mapping.get(s.savedPlaceId)! }));
    next.schedule = incoming.schedule;
    next.context.selectedId = next.plan[0].savedPlaceId;
  }
  if (wasEmpty) next.settings = incoming.settings;
  const validated = stateSchema.safeParse(next);
  if (!validated.success)
    throw new Error("The combined data exceeds Pinny's storage limits. Nothing was imported.");
  return validated.data;
}
