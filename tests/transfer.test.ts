import test from "node:test";
import assert from "node:assert/strict";
import { emptyState } from "../lib/model";
import { converse } from "../lib/conversation";
import { demoState } from "../lib/demo";
import { readBackup, writeBackup, mergeBackup } from "../lib/transfer";

test("personal backup roundtrip preserves experiences and plans without conversation", () => {
  let state = converse(emptyState(), "Save Noodle Place in San Francisco for spicy solo food around $20 https://example.com/noodles");
  state = converse(state, "I want spicy food alone in San Francisco under $25.");
  state = converse(state, "The first one.");
  state = converse(state, "I went. Great food, but too noisy.");
  const text = writeBackup(state);
  assert.ok(!text.includes('"messages"'));
  const imported = mergeBackup(emptyState(), readBackup(text));
  assert.deepEqual(imported.places, JSON.parse(JSON.stringify(state.places)));
  assert.equal(imported.plan.length, 1);
  assert.equal(imported.visits[0].note, "Great food, but too noisy.");
  assert.equal(imported.visits[0].rating, undefined);
  assert.equal(imported.context.selectedId, imported.plan[0].savedPlaceId);
  assert.deepEqual(mergeBackup(imported, readBackup(text)).visits, imported.visits);
});

test("backup merge keeps existing notes and plan while mapping place ID collisions", () => {
  const current = converse(emptyState(), "Save Home Cafe in San Francisco for quiet coffee around $9");
  current.plan = [{ savedPlaceId: current.places[0].id, duration: 30, explanation: "My plan" }];
  const incoming = converse(emptyState(), "Save Noodle Place in San Francisco for spicy food around $20");
  incoming.places[0].id = current.places[0].id;
  incoming.plan = [{ savedPlaceId: incoming.places[0].id, duration: 60, explanation: "Imported plan" }];
  incoming.visits = [{ id: "old-visit", savedPlaceId: incoming.places[0].id, date: "2026-10-10", note: "Good" }];
  const merged = mergeBackup(current, readBackup(writeBackup(incoming)));
  assert.deepEqual(merged.plan, current.plan);
  assert.equal(merged.places.length, 2);
  assert.notEqual(merged.places[0].id, merged.places[1].id);
  assert.equal(merged.visits[0].savedPlaceId, merged.places[1].id);
  const same = converse(emptyState(), "Save Home Cafe in San Francisco for outdoor coffee https://example.com");
  const matched = mergeBackup(current, readBackup(writeBackup(same)));
  assert.equal(matched.places.length, 1);
  assert.ok(matched.places[0].whySaved.includes("quiet coffee"));
  assert.ok(matched.places[0].whySaved.includes("outdoor coffee"));
});

test("invalid, sample, oversized, and dangling-plan backups are rejected", () => {
  assert.throws(() => readBackup('{bad'));
  assert.throws(() => readBackup(JSON.stringify({ format: "wrong", version: 1, data: {} })));
  assert.throws(() => writeBackup(demoState()));
  const valid = JSON.parse(writeBackup(emptyState()));
  valid.data.places = demoState().places;
  assert.throws(() => readBackup(JSON.stringify(valid)), /Sample/);
  valid.data.places = [];
  valid.data.plan = [{ savedPlaceId: "unknown", duration: 30, explanation: "Bad reference" }];
  assert.throws(() => readBackup(JSON.stringify(valid)), /reference/);
  assert.throws(() => readBackup(" ".repeat(2 * 1024 * 1024 + 1)), /2 MB/);
});
