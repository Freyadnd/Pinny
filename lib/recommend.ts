import { SavedPlace, Settings, PlanStop } from "./model";
export type Intent = {
  kinds: string[];
  spicy: boolean;
  nearby: boolean;
  supported: boolean;
};
export function parseIntent(query: string): Intent {
  const q = query.toLowerCase();
  const kinds: string[] = [];
  if (/coffee|cafe|café/.test(q)) kinds.push("coffee");
  if (/walk|park|outside|outdoor/.test(q)) kinds.push("walk");
  if (/dinner|meal|food|eat|lunch|spicy|noodle/.test(q)) kinds.push("food");
  return {
    kinds,
    spicy: /spicy|chili|chilli/.test(q),
    nearby: /nearby|near me|close/.test(q),
    supported:
      kinds.length > 0 ||
      /saved|outing|something|what.*do|recommend|nearby|near me/.test(q),
  };
}
export function kind(place: SavedPlace) {
  const s = `${place.category} ${place.tags.join(" ")}`.toLowerCase();
  return /coffee|cafe/.test(s)
    ? "coffee"
    : /walk|park|outdoors/.test(s)
      ? "walk"
      : /food|dinner|meal|restaurant|noodle/.test(s)
        ? "food"
        : "other";
}
export function duration(place: SavedPlace) {
  return kind(place) === "coffee"
    ? 30
    : kind(place) === "walk"
      ? 45
      : kind(place) === "food"
        ? 60
        : 45;
}
export function recommend(
  places: SavedPlace[],
  settings: Settings,
  query: string,
  budgetExclusive = false,
) {
  const intent = parseIntent(query);
  const location = settings.location.toLowerCase().trim();
  const ranked = places
    .filter((p) => {
      const text =
        `${p.category} ${p.tags.join(" ")} ${p.whySaved}`.toLowerCase();
      const locationMatch =
        !location ||
        location.includes(p.city.toLowerCase()) ||
        p.city.toLowerCase().includes(location) ||
        (p.neighborhood &&
          (location.includes(p.neighborhood.toLowerCase()) ||
            p.neighborhood.toLowerCase().includes(location)));
      if (!locationMatch) return false;
      if (
        settings.budget !== null &&
        (p.budgetEstimate === undefined ||
          p.budgetEstimate > settings.budget ||
          (budgetExclusive && p.budgetEstimate === settings.budget))
      )
        return false;
      if (
        settings.context === "solo" &&
        /group only|group-only|not solo/.test(text)
      )
        return false;
      if (settings.context === "group" && /solo only|solo-only/.test(text))
        return false;
      if (duration(p) > settings.availableTime) return false;
      if (intent.kinds.length && !intent.kinds.includes(kind(p))) return false;
      if (intent.spicy && !/spicy|chili|chilli|sichuan/.test(text))
        return false;
      return true;
    })
    .map((p) => {
      const text = `${p.tags.join(" ")} ${p.whySaved}`.toLowerCase();
      const score =
        (text.includes(settings.context) ? 4 : 0) +
        (location &&
        p.neighborhood &&
        location.includes(p.neighborhood.toLowerCase())
          ? 5
          : 0) +
        (intent.spicy ? 6 : 0);
      const reasons = [
        `Saved for: ${p.whySaved || p.category || "your next outing"}`,
        p.budgetEstimate !== undefined
          ? `Your ${p.sample ? "sample " : ""}estimate: $${p.budgetEstimate}${settings.budget !== null ? " within your per-stop budget" : ""}.`
          : "Price unknown; no dollar-budget claim.",
      ];
      return { place: p, reason: reasons.join(" "), score };
    })
    .sort(
      (a, b) => b.score - a.score || a.place.name.localeCompare(b.place.name),
    );
  // For a mixed outing, make each requested activity visible rather than repeating one kind.
  const diverse: typeof ranked = [];
  if (intent.kinds.length > 1)
    for (const k of intent.kinds) {
      const found = ranked.find((r) => kind(r.place) === k);
      if (found) diverse.push(found);
    }
  for (const r of ranked)
    if (!diverse.some((x) => x.place.id === r.place.id)) diverse.push(r);
  return {
    options: diverse.slice(0, 3),
    intent,
    notice: !intent.supported
      ? "Limited interpretation: Pinny understands coffee, walks, food, spicy meals, and saved outings. These are saved-place matches using your visible controls."
      : intent.nearby
        ? "Nearby uses your typed city or neighborhood, not measured travel distance."
        : "Recommendations use your saved notes, tags, and estimates. No live hours or prices are assumed.",
  };
}
export function buildPlan(
  places: SavedPlace[],
  settings: Settings,
): PlanStop[] {
  let remaining = settings.availableTime;
  const stops: PlanStop[] = [];
  for (const p of places.slice(0, 5)) {
    const minutes = duration(p);
    if (minutes <= remaining) {
      stops.push({
        savedPlaceId: p.id,
        duration: minutes,
        explanation: `Time for ${kind(p) === "other" ? "a visit" : kind(p) === "food" ? "a meal" : kind(p) === "walk" ? "a walk" : "coffee"}. Activity estimate only.`,
      });
      remaining -= minutes;
    }
  }
  return stops;
}
