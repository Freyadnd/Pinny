import { test } from "node:test";
import assert from "node:assert/strict";
import { demoState } from "../lib/demo";
import {
  emptyState,
  duplicateOf,
  httpUrl,
  mapsUrl,
  directionsUrl,
  stateSchema,
} from "../lib/model";
import {
  loadState,
  saveState,
  storageKey,
  StorageLike,
} from "../lib/persistence";
import { recommend, buildPlan } from "../lib/recommend";
import { converse, newId } from "../lib/conversation";
import { parseSchedule, calendarFile } from "../lib/calendar";
function memory(): StorageLike {
  const data = new Map<string, string>();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
  };
}
test("budgeted options exclude unknown and expensive estimates", () => {
  const s = demoState();
  const unknown = { ...s.places[0], id: "unknown", budgetEstimate: undefined };
  const costly = { ...s.places[0], id: "costly", budgetEstimate: 100 };
  const found = recommend(
    [...s.places, unknown, costly],
    { ...s.settings, budget: 25 },
    "spicy food",
  ).options;
  assert.equal(found.length, 2);
  assert.ok(
    found.every(
      (o) =>
        o.place.budgetEstimate !== undefined && o.place.budgetEstimate <= 25,
    ),
  );
});
test("location, activity time, and explicit context incompatibility exclude candidates", () => {
  const s = demoState();
  assert.equal(
    recommend(s.places, { ...s.settings, location: "Los Angeles" }, "food")
      .options.length,
    0,
  );
  assert.equal(
    recommend(s.places, { ...s.settings, availableTime: 20 }, "food").options
      .length,
    0,
  );
  const onlyGroup = { ...s.places[0], tags: ["spicy", "group-only"] };
  assert.equal(recommend([onlyGroup], s.settings, "spicy").options.length, 0);
});
test("unsupported requests disclose limited parsing", () => {
  assert.equal(
    recommend(demoState().places, demoState().settings, "concert tickets")
      .intent.supported,
    false,
  );
});
test("plans do not fabricate stops or activity capacity", () => {
  const s = demoState();
  const plan = buildPlan(s.places, { ...s.settings, availableTime: 60 });
  assert.equal(plan.length, 1);
  assert.ok(plan.reduce((v, p) => v + p.duration, 0) <= 60);
  assert.equal(buildPlan([], s.settings).length, 0);
});
test("demo seeds once and empty stored demo never reseeds", () => {
  const storage = memory();
  const first = loadState(storage, "demo");
  assert.equal(first.state.places.length, 6);
  saveState(storage, "demo", first.state);
  const empty = { ...first.state, places: [] };
  saveState(storage, "demo", empty);
  assert.equal(loadState(storage, "demo").state.places.length, 0);
  assert.equal(loadState(storage, "live").state.places.length, 0);
});
test("malformed JSON and incompatible schemas remain intact", () => {
  for (const raw of ["{bad", JSON.stringify({ version: 2 })]) {
    const storage = memory();
    storage.setItem(storageKey("demo"), raw);
    const loaded = loadState(storage, "demo");
    assert.equal(loaded.writable, false);
    assert.equal(storage.getItem(storageKey("demo")), raw);
    assert.ok(loaded.warning);
  }
});
test("blocked storage still supports a session-only sample journey", () => {
  const storage: StorageLike = {
    getItem() {
      throw Error("denied");
    },
    setItem() {
      throw Error("quota");
    },
  };
  assert.equal(loadState(storage, "demo").state.places.length, 6);
  assert.equal(loadState(storage, "demo").writable, false);
  assert.ok(saveState(storage, "live", emptyState()));
});
test("legacy v1 data retains places, plan, and authored numerical ratings", () => {
  const storage = memory();
  const s = demoState();
  const legacy = {
    version: 1,
    places: s.places,
    settings: s.settings,
    plan: [
      { savedPlaceId: s.places[0].id, duration: 60, explanation: "My meal" },
    ],
    visits: [
      {
        id: "old",
        savedPlaceId: s.places[0].id,
        date: "2026-10-10",
        rating: 4,
        note: "Personal note",
      },
    ],
  };
  storage.setItem(storageKey("demo"), JSON.stringify(legacy));
  const loaded = loadState(storage, "demo");
  assert.equal(loaded.writable, true);
  assert.equal(loaded.state.visits[0].rating, 4);
  assert.equal(loaded.state.plan.length, 1);
  assert.deepEqual(loaded.state.messages, []);
});
test("complete follow-up journey survives validated persistence without fabricated rating", () => {
  let s = converse(demoState(), "I want spicy food alone under $25.");
  assert.equal(s.context.candidateIds.length, 2);
  const chosen = s.context.candidateIds[1];
  s = converse(s, "The second one, then a walk.");
  assert.equal(s.plan.length, 2);
  assert.equal(s.plan[0].savedPlaceId, chosen);
  s = converse(s, "Make it tonight at six.", new Date(2026, 9, 11, 12));
  assert.equal(s.schedule?.confirmed, false);
  assert.equal(new Date(s.schedule!.start).getHours(), 18);
  assert.throws(() => calendarFile(s));
  s = converse(s, "Confirm.");
  assert.ok(calendarFile(s).includes("BEGIN:VEVENT"));
  s = converse(s, "I went. Great food, but too noisy.");
  assert.equal(s.visits[0].savedPlaceId, chosen);
  assert.equal(s.visits[0].note, "Great food, but too noisy.");
  assert.equal(s.visits[0].rating, undefined);
  assert.equal(stateSchema.safeParse(s).success, true);
  const storage = memory();
  saveState(storage, "demo", s);
  assert.deepEqual(
    loadState(storage, "demo").state,
    JSON.parse(JSON.stringify(s)),
  );
});
test("personal experience affects future quiet requests", () => {
  let s = converse(demoState(), "spicy food");
  s = converse(s, "the second one");
  const noisy = s.context.selectedId;
  s = converse(s, "I went. Good but too noisy.");
  s = converse(s, "quiet spicy food");
  assert.ok(!s.context.candidateIds.includes(noisy!));
});
test("a missing city asks one question and retains constraints", () => {
  let s = emptyState();
  s.places = demoState().places.map((p) => ({ ...p, sample: false }));
  s = converse(s, "spicy food alone under $25");
  assert.ok(s.messages.at(-1)?.text.includes("Which city"));
  s = converse(s, "San Francisco");
  assert.equal(s.context.candidateIds.length, 2);
  assert.equal(s.settings.budget, 25);
});
test("link-only inspiration asks for name and city and never reads content", () => {
  let s = converse(emptyState(), "https://www.tiktok.com/@someone/video/123");
  assert.equal(s.places.length, 0);
  assert.ok(s.messages.at(-1)?.text.includes("place name and city"));
  s = converse(s, "Coffee Nook in San Francisco for quiet coffee around $9");
  assert.equal(s.places.length, 1);
  assert.equal(
    s.places[0].inspirationLinks[0],
    "https://www.tiktok.com/@someone/video/123",
  );
  assert.equal(s.places[0].budgetEstimate, 9);
  assert.equal(s.places[0].sample, undefined);
});
test("inspiration duplicates merge only after explicit instruction", () => {
  let s = converse(
    emptyState(),
    "Save Coffee Nook in SF for coffee around $9 https://example.com/a",
  );
  s = converse(
    s,
    "Save Coffee Nook in SF for a quiet coffee https://example.com/b",
  );
  assert.equal(s.places.length, 1);
  assert.equal(s.places[0].inspirationLinks.length, 1);
  s = converse(s, "merge inspiration");
  assert.equal(s.places[0].inspirationLinks.length, 2);
});
test("unsafe URLs rejected and Maps links encode destination correctly", () => {
  assert.equal(httpUrl.safeParse("javascript:alert(1)").success, false);
  const p = {
    ...demoState().places[0],
    name: "Food & Friends",
    placeId: "abc",
  };
  const u = new URL(directionsUrl(p, "San Francisco"));
  assert.equal(u.searchParams.get("api"), "1");
  assert.equal(
    u.searchParams.get("destination"),
    "Food & Friends, San Francisco",
  );
  assert.equal(u.searchParams.get("destination_place_id"), "abc");
  assert.equal(
    new URL(directionsUrl({ ...p, placeId: undefined })).searchParams.has(
      "origin",
    ),
    false,
  );
  assert.ok(mapsUrl({ ...p, placeId: undefined }).includes("/search/"));
  assert.equal(duplicateOf([p], { ...p, id: "other" })?.id, p.id);
});
test("schedule parser asks for ambiguous time and validates date", () => {
  const now = new Date(2026, 9, 11, 12);
  assert.ok(parseSchedule("tomorrow at six", now).question);
  assert.equal(
    new Date(parseSchedule("tomorrow at 6 pm", now).start!).getHours(),
    18,
  );
  assert.ok(parseSchedule("2026-02-30 at 6 pm", now).question);
  assert.equal(
    new Date(parseSchedule("2026-10-15 at 18:30", now).start!).getDate(),
    15,
  );
});
test("changing a plan invalidates calendar confirmation", () => {
  let s = converse(demoState(), "spicy food");
  s = converse(s, "second then a walk");
  s = converse(s, "tonight at six");
  s = converse(s, "confirm");
  assert.equal(s.schedule?.confirmed, true);
  s = converse(s, "remove the walk");
  assert.equal(s.schedule, null);
  assert.equal(s.plan.length, 1);
});
test("budget-only follow-ups keep the spicy intent and other context", () => {
  let s = converse(demoState(), "I want spicy food alone under $25");
  s = converse(s, "under $23");
  assert.equal(s.context.candidateIds.length, 1);
  assert.equal(s.context.candidateIds[0], "sample-1");
  assert.equal(s.settings.context, "solo");
  assert.equal(s.settings.location, "San Francisco");
  assert.ok(s.context.lastQuery?.includes("spicy"));
});
test("ambiguous scheduling accepts a short follow-up meridiem", () => {
  let s = converse(demoState(), "spicy food");
  s = converse(s, "second one");
  s = converse(s, "tomorrow at 6");
  assert.ok(s.context.pendingSchedule);
  s = converse(s, "6pm");
  assert.equal(new Date(s.schedule!.start).getHours(), 18);
});
test("under-budget phrasing excludes the exact boundary; inclusive phrasing keeps it", () => {
  const s = demoState();
  s.places = [{ ...s.places[0], budgetEstimate: 25 }];
  const strict = converse(s, "spicy food under $25");
  assert.equal(strict.context.candidateIds.length, 0);
  const inclusive = converse(s, "spicy food up to $25");
  assert.equal(inclusive.context.candidateIds.length, 1);
});
test("invalid saved timezones fail validation and calendar text cannot inject events", () => {
  const s = demoState();
  assert.equal(
    stateSchema.safeParse({
      ...s,
      schedule: {
        start: new Date().toISOString(),
        timezone: "Not/AZone",
        confirmed: true,
      },
    }).success,
    false,
  );
  s.places[0].name = "Place\nBEGIN:VALARM";
  s.places[0].id = "id\r\nEND:VEVENT";
  s.plan = [
    {
      savedPlaceId: s.places[0].id,
      duration: 60,
      explanation: "Activity estimate",
    },
  ];
  s.schedule = {
    start: new Date().toISOString(),
    timezone: "UTC",
    confirmed: true,
  };
  const file = calendarFile(s);
  assert.equal((file.match(/\r\nEND:VEVENT\r\n/g) || []).length, 1);
  assert.ok(file.includes("Place\\nBEGIN:VALARM"));
});
test("record IDs still work when secure-context randomUUID is unavailable", () => {
  const descriptor = Object.getOwnPropertyDescriptor(crypto, "randomUUID");
  Object.defineProperty(crypto, "randomUUID", {
    value: undefined,
    configurable: true,
  });
  try {
    assert.match(newId(), /^pinny-[a-z0-9]+-[a-z0-9]+-[a-z0-9]+$/);
  } finally {
    if (descriptor) Object.defineProperty(crypto, "randomUUID", descriptor);
    else Reflect.deleteProperty(crypto, "randomUUID");
  }
});
test("loading existing storage never asks for hydration writes and preserves orphaned personal history", () => {
  const storage = memory();
  const s = demoState();
  s.visits = [
    {
      id: "legacy",
      savedPlaceId: "missing-place",
      date: "2026-10-10",
      note: "A memory that must not disappear",
    },
  ];
  const raw = JSON.stringify(s, null, 2);
  storage.setItem(storageKey("demo"), raw);
  const loaded = loadState(storage, "demo");
  assert.equal(loaded.fresh, undefined);
  assert.equal(loaded.state.visits[0].note, "A memory that must not disappear");
  assert.equal(storage.getItem(storageKey("demo")), raw);
});
test("only a missing namespace requests first-time seeding", () => {
  const storage = memory();
  assert.equal(loadState(storage, "demo").fresh, true);
  saveState(storage, "demo", emptyState());
  assert.equal(loadState(storage, "demo").fresh, undefined);
  assert.equal(loadState(storage, "demo").state.places.length, 0);
});
