import {
  State,
  Message,
  SavedPlace,
  duplicateOf,
  httpUrl,
  normalized,
} from "./model";
import { recommend, buildPlan, kind } from "./recommend";
import { parseSchedule, scheduleLabel } from "./calendar";
export const newId = () => {
  // IDs are local record identifiers, not authentication tokens. Keep text working
  // on HTTP LAN demos where randomUUID may be unavailable outside a secure context.
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return `pinny-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
};
function append(
  state: State,
  role: Message["role"],
  text: string,
  extra: Partial<Message> = {},
) {
  const message: Message = { id: newId(), role, text, kind: "text", ...extra };
  state.messages = [...state.messages, message].slice(-100);
}
const reply = (state: State, text: string, extra: Partial<Message> = {}) => {
  append(state, "assistant", text, extra);
  return state;
};
function applyConstraints(state: State, text: string) {
  const q = text.toLowerCase();
  const money =
    q.match(
      /(?:under|below|less than|up to|budget(?: is| of)?|around|max(?:imum)?)\s*\$?\s*(\d+(?:\.\d+)?)/,
    ) || q.match(/\$(\d+(?:\.\d+)?)/);
  if (/no budget|any budget|clear budget/.test(q)) {
    state.settings.budget = null;
    state.context.budgetExclusive = false;
  } else if (money) {
    state.settings.budget = Math.min(10000, Number(money[1]));
    state.context.budgetExclusive = /under|below|less than/.test(q);
  }
  if (/alone|solo|by myself|on my own/.test(q)) state.settings.context = "solo";
  else if (/friends|group|together|with my|\bwe\b/.test(q))
    state.settings.context = "group";
  const time = q.match(/(\d+(?:\.\d+)?)\s*(hours?|hrs?|minutes?|mins?)\b/);
  if (time)
    state.settings.availableTime = Math.max(
      15,
      Math.min(
        480,
        Math.round(Number(time[1]) * (time[2].startsWith("h") ? 60 : 1)),
      ),
    );
  const location = text.match(
    /(?:\bin|\bnear|location is|city is)\s+([\p{L}\p{N} ,'-]+?)(?=\s+(?:under|below|for|with|alone|solo|and|budget)\b|[.!?]|$)/iu,
  );
  if (location && !/me$|the second|the first/i.test(location[1]))
    state.settings.location = location[1].trim().slice(0, 120);
}
function rememberPlace(state: State, input: string) {
  if (state.places.length >= 500)
    return reply(
      state,
      "This workspace has reached its 500-place limit. Remove a place before saving another.",
    );
  const links = (input.match(/https?:\/\/[^\s]+/g) || []).map((l) =>
    l.replace(/[.,;)]+$/, ""),
  );
  if (links.some((l) => !httpUrl.safeParse(l).success))
    return reply(state, "Please use an http or https link.");
  const cleaned = input
    .replace(/https?:\/\/[^\s]+/g, "")
    .replace(/^(?:save|remember|add)\s+(?:this\s+)?/i, "")
    .trim();
  const match = cleaned.match(
    /^(.+?)\s+in\s+(.+?)(?=\s+(?:because|for|budget|around|under|about)\b|[.!;]|$)/i,
  );
  if (!match) {
    state.context.pendingSave = input;
    return reply(
      state,
      links.length
        ? "Link saved in this conversation. Add the place name and city so Pinny can use it. For example, “Saint Frank Coffee in San Francisco for a quiet coffee.”"
        : "What’s the place name and city? You can add why you saved it in the same sentence.",
    );
  }
  const name = match[1].trim().slice(0, 120),
    city = match[2].trim().slice(0, 120);
  const reason = cleaned
    .slice(match[0].length)
    .replace(/^[ .;]+/, "")
    .replace(/^(because|for)\s+/i, "")
    .trim()
    .slice(0, 2000);
  const budget = cleaned.match(
    /(?:budget|around|under|about)\s*\$?\s*(\d+(?:\.\d+)?)/i,
  );
  const tags = [
    "coffee",
    "spicy",
    "solo",
    "quiet",
    "walk",
    "dinner",
    "group",
    "outdoors",
  ].filter((t) => cleaned.toLowerCase().includes(t));
  const category = tags.includes("coffee")
    ? "Coffee"
    : tags.includes("walk")
      ? "Walk"
      : /food|dinner|spicy|noodle/i.test(cleaned)
        ? "Food"
        : "Other";
  const place: SavedPlace = {
    id: newId(),
    name,
    city,
    category,
    neighborhood: "",
    inspirationLinks: [...new Set(links)].slice(0, 20),
    whySaved: reason,
    tags,
    budgetEstimate: budget ? Math.min(Number(budget[1]), 10000) : undefined,
    createdAt: new Date().toISOString(),
    sample: state.places.some((p) => p.sample) || undefined,
  };
  const duplicate = duplicateOf(state.places, place);
  if (duplicate) {
    state.context.pendingSave = input;
    return reply(
      state,
      `You already saved ${duplicate.name} in ${duplicate.city}. Say “merge inspiration” to add these links and notes to it, or “cancel” to keep it as-is.`,
    );
  }
  state.places.push(place);
  state.context.pendingSave = undefined;
  state.context.selectedId = place.id;
  return reply(
    state,
    `Saved ${name} in ${city}${reason ? ` — ${reason}` : ""}. ${links.length ? "The link is a reference; I haven’t read the post. " : ""}${budget ? "Your budget estimate is saved." : "Price is unknown; I won’t assume it fits a dollar budget."}`,
    { savedPlaceId: place.id },
  );
}
export function converse(
  previous: State,
  input: string,
  now = new Date(),
): State {
  const state = structuredClone(previous);
  const text = input.trim().slice(0, 2000);
  if (!text) return state;
  append(state, "user", text);
  const q = text.toLowerCase();
  if (/^cancel\b/.test(q)) {
    state.context.pendingQuery = undefined;
    state.context.pendingSave = undefined;
    state.context.pendingSchedule = undefined;
    return reply(state, "Okay, canceled. What would you like to do instead?");
  }
  if (state.context.pendingSave && /merge inspiration/.test(q)) {
    const pending = state.context.pendingSave;
    const match = pending
      .replace(/https?:\/\/[^\s]+/g, "")
      .replace(/^(save|remember|add)\s+/i, "")
      .trim()
      .match(
        /^(.+?)\s+in\s+(.+?)(?=\s+(?:because|for|budget|around|under|about)\b|[.!;]|$)/i,
      );
    const target =
      match &&
      state.places.find(
        (p) =>
          normalized(p.name) === normalized(match[1]) &&
          normalized(p.city) === normalized(match[2]),
      );
    if (target) {
      const links = (pending.match(/https?:\/\/[^\s]+/g) || []).map((l) =>
        l.replace(/[.,;)]+$/, ""),
      );
      target.inspirationLinks = [
        ...new Set([...target.inspirationLinks, ...links]),
      ].slice(0, 20);
      const note = pending
        .replace(/https?:\/\/[^\s]+/g, "")
        .split(/\s+(?:because|for)\s+/i)
        .slice(1)
        .join(" ")
        .trim();
      if (note)
        target.whySaved =
          `${target.whySaved}${target.whySaved ? " · " : ""}${note}`.slice(
            0,
            2000,
          );
      state.context.pendingSave = undefined;
      state.context.selectedId = target.id;
      return reply(
        state,
        `Merged the inspiration for ${target.name}. Your existing place and experiences are kept.`,
      );
    }
  }
  if (state.context.pendingSave) {
    const pending = state.context.pendingSave;
    state.context.pendingSave = undefined;
    return rememberPlace(
      state,
      `${text} ${pending.match(/https?:\/\/[^\s]+/g)?.join(" ") || ""}`,
    );
  }
  if (/^(save|remember|add)(?:\s|$)/i.test(text) || /^https?:\/\//i.test(text))
    return rememberPlace(state, text);
  if (
    /\b(i went|went there|i visited|we went|just visited|visited it)\b/.test(q)
  ) {
    if (state.visits.length >= 3000)
      return reply(
        state,
        "This workspace has reached its experience limit. Your existing notes are kept.",
      );
    const place =
      state.places.find((p) => q.includes(p.name.toLowerCase())) ||
      state.places.find((p) => p.id === state.context.selectedId) ||
      state.places.find((p) => p.id === state.plan[0]?.savedPlaceId);
    if (!place)
      return reply(
        state,
        "Which saved place did you visit? Choose a place from your inspiration first, then tell me how it went.",
      );
    const note =
      text
        .replace(
          /^.*?\b(?:i went|went there|i visited|we went|just visited|visited it)[.!,:\s]*/i,
          "",
        )
        .trim() || text;
    state.visits.push({
      id: newId(),
      savedPlaceId: place.id,
      date: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`,
      note,
    });
    return reply(
      state,
      `Remembered for ${place.name}: “${note}”${/nois|loud/i.test(note) ? " I’ll flag this personal experience when you want somewhere quiet." : ""}`,
      { kind: "experience", savedPlaceId: place.id },
    );
  }
  if (
    /^(confirm|yes|looks good|that works)(\b|[.!])/.test(q) &&
    state.schedule &&
    !state.schedule.confirmed
  ) {
    state.schedule.confirmed = true;
    return reply(
      state,
      `Confirmed: ${scheduleLabel(state.schedule.start, state.schedule.timezone)}. Your calendar file is ready to download.`,
      { kind: "schedule" },
    );
  }
  if (
    /tonight|tomorrow|today|at\s+(?:\d|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)|monday|tuesday|wednesday|thursday|friday|saturday|sunday|\d{4}-\d{2}-\d{2}/.test(
      q,
    ) ||
    state.context.pendingSchedule
  ) {
    if (!state.plan.length)
      return reply(
        state,
        "Let’s choose a place first. What would you like to do?",
      );
    const combined = state.context.pendingSchedule
      ? `${state.context.pendingSchedule} ${text}`
      : text;
    const parsed = parseSchedule(combined, now);
    if (!parsed.start) {
      state.context.pendingSchedule = combined;
      return reply(state, parsed.question || "What day and time?");
    }
    state.context.pendingSchedule = undefined;
    state.schedule = {
      start: parsed.start,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      confirmed: false,
    };
    return reply(
      state,
      `I interpreted that as ${scheduleLabel(parsed.start, state.schedule.timezone)}.${new Date(parsed.start) <= now ? " This time is in the past; choose a later time or confirm if intentional." : ""} Confirm this time before exporting.`,
      { kind: "schedule" },
    );
  }
  applyConstraints(state, text);
  if (state.context.pendingQuery) {
    state.settings.location = text
      .replace(/^(in|near|i am in|i'm in)\s+/i, "")
      .trim()
      .slice(0, 120);
    const query = state.context.pendingQuery;
    state.context.pendingQuery = undefined;
    return showRecommendations(state, query);
  }
  if (
    /^(remove|drop)\s+(the\s+)?(?:walk|last|coffee|dinner|first|second)/.test(q)
  ) {
    const index = /last/.test(q)
      ? state.plan.length - 1
      : /second/.test(q)
        ? 1
        : /first/.test(q)
          ? 0
          : state.plan.findIndex(
              (s) =>
                kind(state.places.find((p) => p.id === s.savedPlaceId)!) ===
                (q.includes("walk")
                  ? "walk"
                  : q.includes("coffee")
                    ? "coffee"
                    : "food"),
            );
    if (index >= 0 && state.plan[index]) state.plan.splice(index, 1);
    state.schedule = null;
    return reply(
      state,
      "Updated your plan. Any calendar time needs confirmation again.",
      { kind: "plan" },
    );
  }
  const ordinal = q.match(
    /\b(first|second|1st|2nd|one|two)\s*(?:one|option)?\b/,
  );
  const selected = ordinal
    ? state.places.find(
        (p) =>
          p.id ===
          state.context.candidateIds[/second|2nd|two/.test(ordinal[1]) ? 1 : 0],
      )
    : state.places.find((p) => q.includes(p.name.toLowerCase()));
  if (selected || (/then|add a|and a/.test(q) && state.context.selectedId)) {
    const primary =
      selected || state.places.find((p) => p.id === state.context.selectedId);
    if (!primary)
      return reply(state, "Which saved place should we start with?");
    state.context.selectedId = primary.id;
    let candidates = [primary];
    if (/walk|coffee/.test(q)) {
      const activity = q.includes("walk") ? "walk" : "coffee";
      const extra = recommend(
        state.places.filter((p) => p.id !== primary.id),
        state.settings,
        activity,
        state.context.budgetExclusive,
      ).options[0]?.place;
      if (extra) candidates.push(extra);
    }
    if (!selected && state.plan.length)
      candidates = [
        ...state.plan
          .map((s) => state.places.find((p) => p.id === s.savedPlaceId)!)
          .filter(Boolean),
        ...candidates.filter(
          (p) => !state.plan.some((s) => s.savedPlaceId === p.id),
        ),
      ];
    state.plan = buildPlan(candidates, state.settings);
    state.schedule = null;
    if (!state.plan.length)
      return reply(
        state,
        "That activity needs more time than your current limit. How much time do you have?",
      );
    const askedExtra = /walk|coffee/.test(q);
    const extraMissing = askedExtra && state.plan.length < 2;
    return reply(
      state,
      `${primary.name}${state.plan.length > 1 ? `, then ${state.places.find((p) => p.id === state.plan[1].savedPlaceId)?.name}` : ""}. ${extraMissing ? "I couldn’t add another matching saved stop within your activity-time limit. " : ""}Activity estimates exclude travel. Check the destinations and opening hours before heading out.`,
      { kind: "plan" },
    );
  }
  if (/plan|let's go|lets go/.test(q) && state.context.candidateIds.length) {
    const candidates = state.context.candidateIds
      .map((id) => state.places.find((p) => p.id === id))
      .filter((p): p is SavedPlace => !!p);
    state.plan = buildPlan(candidates, state.settings);
    state.context.selectedId = state.plan[0]?.savedPlaceId;
    state.schedule = null;
    return reply(
      state,
      "Here’s a short plan from your current options. Activity estimates exclude travel.",
      { kind: "plan" },
    );
  }
  if (!state.settings.location) {
    state.context.pendingQuery = text;
    return reply(state, "Which city or neighborhood should I look in?");
  }
  const changesOnly =
    /budget|under|below|cheaper|alone|solo|friends|group|i have|location|city is|in\s+/i.test(
      text,
    ) &&
    !/coffee|cafe|walk|food|meal|spicy|dinner|lunch|outing|something|what.*do/i.test(
      text,
    );
  if (/cheaper/.test(q) && !/(?:\$|under|below|budget)/.test(q))
    return reply(
      state,
      "What per-person budget should I use? For example, “under $20.”",
    );
  return showRecommendations(
    state,
    changesOnly && state.context.lastQuery ? state.context.lastQuery : text,
  );
}
function showRecommendations(state: State, query: string) {
  state.context.lastQuery = query;
  const result = recommend(
    state.places,
    state.settings,
    query,
    state.context.budgetExclusive,
  );
  let options = [...result.options].sort(
    (a, b) =>
      Number(
        state.visits.some(
          (v) => v.savedPlaceId === a.place.id && /nois|loud/i.test(v.note),
        ),
      ) -
      Number(
        state.visits.some(
          (v) => v.savedPlaceId === b.place.id && /nois|loud/i.test(v.note),
        ),
      ),
  );
  if (/quiet|peaceful|not noisy/.test(query.toLowerCase())) {
    options = options.filter(
      (o) =>
        !state.visits.some(
          (v) => v.savedPlaceId === o.place.id && /nois|loud/i.test(v.note),
        ),
    );
  }
  const ids = options.slice(0, 2).map((o) => o.place.id);
  state.context.candidateIds = ids;
  if (!ids.length)
    return reply(
      state,
      `No grounded matches in your saved inspiration for these constraints. Unknown prices don’t count as within budget. Try another location, relax the budget, or save a place with your own estimate. ${!result.intent.supported ? result.notice : ""}`,
    );
  return reply(
    state,
    `${!result.intent.supported ? result.notice + " " : ""}Found ${ids.length === 1 ? "one saved option" : "two saved options"}${result.intent.spicy ? " for your spicy-food craving" : ""}. ${state.settings.budget !== null ? `Using your per-person estimate ${state.context.budgetExclusive ? `under $${state.settings.budget}` : `of $${state.settings.budget} or less`}, per stop. ` : ""}${ids.length === 2 ? "Say “the second one, then a walk” or choose a card." : "Choose this place, or tell me what to change."}`,
    { kind: "options", candidateIds: ids },
  );
}
