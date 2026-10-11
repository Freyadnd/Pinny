import test from "node:test";
import assert from "node:assert/strict";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { emptyState, stateSchema, SavedPlace } from "../lib/model";
import { intentSchema, actionSchema, applyLiveResult, ModelAction, zonedTime } from "../lib/live";
import { runAgent, validateAction, retrievalSources, AgentInput, verifiedPlace, signedPlace } from "../lib/agent";
import { POST } from "../app/api/recommend/route";
const key = "unit-test-not-a-real-key";
const base = (): ModelAction => ({ reply: "Here are grounded suggestions. Quietness is unknown.", kind: "recommend", options: [], stops: [], discovered: [], sourceIds: [], settings: null, schedule: null, outingDate: null, save: null, visit: null, preference: null, event: null, eventChoice: "keep" });
const input = (): AgentInput => ({ text: "Find a coffee spot nearby where I can sit quietly.", state: emptyState(), timezone: "America/Los_Angeles", location: { latitude: 37.775, longitude: -122.419, accuracy: 100 } });
const source = { url: "https://example.com/official-cafe", title: "Official venue (mock source)" };
function discovered(ref: string, name: string) { return { ref, name, city: "San Francisco", category: "Coffee" as const, address: "Test address from mocked primary source", facts: "Coffee seating is listed in this mocked source.", uncertainty: "Popularity and quietness are unknown. Check at your intended time.", sourceIds: [0] }; }
function response(text: unknown, extra: unknown[] = []) { return new Response(JSON.stringify({ id: "resp_test", object: "response", created_at: 1, status: "completed", output: [...extra, { id: "msg_test", type: "message", status: "completed", role: "assistant", content: [{ type: "output_text", text: typeof text === "string" ? text : JSON.stringify(text), annotations: [] }] }] }), { headers: { "Content-Type": "application/json" } }); }

test("official SDK mocked research flow retains retrieval URLs, context and candidate ordering", async () => {
  const requests: Record<string, unknown>[] = [];
  const request = input();
  request.state.preferences = ["I prefer quiet seating."];
  request.state.visits = [{ id: "experience", savedPlaceId: "old", date: "2026-10-10", note: "Great food, but too noisy." }];
  const action = { ...base(), options: [{ id: "cafe-a", reason: "Based on your quiet preference; actual noise is unknown." }, { id: "cafe-b", reason: "Another sourced option." }], discovered: [discovered("cafe-a", "Test Cafe A"), discovered("cafe-b", "Test Cafe B")], sourceIds: [0] };
  const client = new OpenAI({ apiKey: key, maxRetries: 0, fetch: async (_url, init) => {
    const body = JSON.parse(String(init?.body)); requests.push(body);
    if (requests.length === 1) return response({ research: true, researchQuery: "Find primary venue sources, acknowledging unknown noise.", locationNeeded: true, question: null });
    if (requests.length === 2) return response("Mock evidence report only.", [{ id: "search_test", type: "web_search_call", status: "completed", action: { type: "search", query: "cafe", sources: [source] } }]);
    return response(action);
  } });
  const result = await runAgent(request, key, AbortSignal.timeout(5000), client);
  assert.equal(requests.length, 3);
  assert.equal(requests[1].max_tool_calls, 3);
  assert.equal(requests[1].store, false);
  assert.equal((requests[1].tools as { type: string }[])[0].type, "web_search");
  assert.ok(String(requests[0].input).includes("too noisy"));
  assert.ok(String(requests[2].input).includes("quiet seating"));
  assert.equal(result.candidates.length, 2);
  assert.equal(result.candidates[0].web?.citations[0].url, source.url);
  assert.equal(verifiedPlace(result.candidates[0], key), true);
  let state = applyLiveResult(request.state, request.text, result);
  assert.equal(state.places.length, 0); // suggestions are not silently saved
  assert.equal(state.research.length, 2);
  const second = state.context.candidateIds[1];
  const walk: SavedPlace = { ...state.research[0], id: "walk-test", name: "Test Park", category: "Walk" };
  state.research.push(signedPlace(walk, key));
  const followup = { ...base(), kind: "plan" as const, reply: "The second cafe, then a short walk. No extra coffee stop.", stops: [{ id: second, duration: 30, reason: "Your chosen second option." }, { id: walk.id, duration: 20, reason: "A short walk; travel extra." }] };
  state = applyLiveResult(state, "The second one, but no extra coffee stop. Add a short walk.", validateAction(followup, { ...request, state }, [], key));
  assert.equal(state.plan.length, 2);
  assert.equal(state.plan[0].savedPlaceId, second);
  assert.equal(state.places.length, 2);
  assert.equal(state.messages.at(-1)?.text.includes("No extra coffee"), true);
});

test("unknown candidate/citation IDs and unsourced invented places are rejected atomically", () => {
  const request = input();
  assert.throws(() => validateAction({ ...base(), options: [{ id: "invented", reason: "Wrong" }] }, request, [], key), /Unknown candidate/);
  assert.throws(() => validateAction({ ...base(), sourceIds: [99] }, request, [source], key), /citation/);
  assert.throws(() => validateAction({ ...base(), discovered: [{ ...discovered("new", "Wrong"), sourceIds: [] }] }, request, [], key), /retrieved source/);
  assert.throws(() => validateAction({ ...base(), reply: "https://invented.example" }, request, [], key), /generated URLs/);
  assert.deepEqual(retrievalSources([{ type: "message", content: [{ type: "output_text", text: "https://invented.example", annotations: [] }] }]), []);
  assert.deepEqual(request.state, emptyState());
});

test("Restaurant Week mismatch offers verified dates or normal evening; 6:30 retains chosen date", () => {
  const request = input();
  request.text = "Help me plan an evening for SF Restaurant Week.";
  const eventSource = { url: "https://www.sfrestaurantweek.com/", title: "Official event organizer (mock dates)" };
  const action = { ...base(), event: { name: "SF Restaurant Week", startDate: "2026-11-06", endDate: "2026-11-15", sourceIds: [0] } };
  const result = validateAction(action, request, [eventSource], key, new Date("2026-10-11T18:00:00Z"));
  assert.equal(result.kind, "reply"); assert.equal(result.stops.length, 0);
  assert.match(result.reply, /outside those dates/); assert.match(result.reply, /normal evening/);
  request.state.event = result.event;
  request.state.places = [{ id: "chosen", name: "Test Cafe", city: "San Francisco", category: "Food", neighborhood: "", whySaved: "User chosen", inspirationLinks: [], tags: [], createdAt: "2026-10-11T18:00:00Z" }];
  request.state.plan = [{ savedPlaceId: "chosen", duration: 60, explanation: "My plan" }];
  request.state.schedule = { start: "2026-11-08T02:00:00Z", timezone: request.timezone, confirmed: true };
  const scheduled = validateAction({ ...base(), kind: "schedule", reply: "November 7 at 6:30 pm. Please confirm.", schedule: { date: "2026-11-07", time: "18:30" } }, { ...request, text: "Make it six thirty." }, [], key);
  assert.equal(scheduled.schedule?.start, "2026-11-08T02:30:00.000Z");
  const state = applyLiveResult(request.state, "Make it six thirty.", scheduled);
  assert.equal(state.schedule?.confirmed, false);
  assert.equal(state.plan[0].savedPlaceId, "chosen");
  assert.throws(() => zonedTime("2026-03-08", "02:30", request.timezone), /does not exist/);
});

test("live preference and personal visit note persist without invented numerical rating", () => {
  const request = input(); request.text = "Remember that I prefer quieter restaurants.";
  const preference = validateAction({ ...base(), kind: "preference", reply: "I'll remember that.", preference: "I prefer quieter restaurants." }, request, [], key);
  const state = applyLiveResult(request.state, request.text, preference);
  assert.equal(stateSchema.parse(JSON.parse(JSON.stringify(state))).preferences[0], "I prefer quieter restaurants.");
  request.state = state; request.text = "I went. Great food, but too noisy.";
  request.state.places = [{ id: "chosen", name: "Test Place", city: "San Francisco", category: "Food", neighborhood: "", whySaved: "User chosen", inspirationLinks: [], tags: [], createdAt: new Date().toISOString() }];
  const visited = validateAction({ ...base(), kind: "visit", reply: "Remembered your own experience.", visit: { placeId: "chosen", note: "Great food, but too noisy." } }, request, [], key);
  const updated = applyLiveResult(state, request.text, visited);
  assert.equal(updated.visits[0].rating, undefined);
  assert.throws(() => validateAction({ ...base(), kind: "visit", visit: { placeId: "chosen", note: "Five stars and romantic" } }, request, [], key), /user's own words/);
});

test("SDK follow-up without current facts skips web search, and schemas compile for structured output", async () => {
  assert.equal(zodTextFormat(actionSchema, "action").type, "json_schema");
  assert.equal(zodTextFormat(intentSchema, "intent").type, "json_schema");
  const bodies: Record<string, unknown>[] = [];
  const client = new OpenAI({ apiKey: key, maxRetries: 0, fetch: async (_url, init) => {
    const body = JSON.parse(String(init?.body)); bodies.push(body);
    return response(bodies.length === 1 ? { research: false, researchQuery: "", locationNeeded: false, question: null } : { ...base(), kind: "reply", reply: "Which day should I use?" });
  } });
  await runAgent({ ...input(), text: "Make it six thirty." }, key, AbortSignal.timeout(5000), client);
  assert.equal(bodies.length, 2); assert.ok(bodies.every((b) => !b.tools));
});

test("recommend route bounds requests, rejects sample mode and missing keys honestly", async () => {
  const original = process.env.OPENAI_API_KEY; delete process.env.OPENAI_API_KEY;
  try {
    assert.equal((await POST(new Request("http://localhost/api/recommend", { method: "POST", body: JSON.stringify(input()) }))).status, 503);
    assert.equal((await POST(new Request("http://localhost/api/recommend", { method: "POST", body: "bad" }))).status, 400);
    assert.equal((await POST(new Request("http://localhost/api/recommend", { method: "POST", body: " ".repeat(131073) }))).status, 413);
    assert.equal((await POST(new Request("http://localhost/api/recommend", { method: "POST", headers: { Origin: "https://unrelated.example" }, body: JSON.stringify(input()) }))).status, 403);
    assert.equal((await POST(new Request("http://localhost/api/recommend", { method: "POST", headers: { Host: "127.0.0.1:3001", Origin: "http://127.0.0.1:3001" }, body: JSON.stringify(input()) }))).status, 503);
    assert.equal((await POST(new Request("http://localhost/api/recommend", { method: "POST", headers: { Origin: "null" }, body: JSON.stringify(input()) }))).status, 403);
  } finally { if (original) process.env.OPENAI_API_KEY = original; }
});

test("provider failure is sanitized without modifying data or substituting samples", async () => {
  const original = process.env.OPENAI_API_KEY;
  const originalFetch = globalThis.fetch;
  process.env.OPENAI_API_KEY = key;
  globalThis.fetch = async () => { throw new Error("Mock upstream failure with sensitive data"); };
  try {
    const request = input();
    const before = JSON.stringify(request.state);
    const response = await POST(new Request("http://localhost/api/recommend", { method: "POST", body: JSON.stringify(request) }));
    assert.equal(response.status, 502);
    const text = await response.text();
    assert.ok(!text.includes("sensitive data") && !text.includes(key));
    assert.equal(JSON.stringify(request.state), before);
  } finally {
    globalThis.fetch = originalFetch;
    if (original) process.env.OPENAI_API_KEY = original; else delete process.env.OPENAI_API_KEY;
  }
});
