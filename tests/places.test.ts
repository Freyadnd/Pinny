import { test } from "node:test";
import assert from "node:assert/strict";
import { POST } from "../app/api/places/search/route";
const request = (body: unknown) =>
  new Request("http://localhost/api/places/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
test("Places route rejects missing fields, malformed JSON, and oversized input", async () => {
  assert.equal((await POST(request({ name: "A" }))).status, 400);
  assert.equal(
    (
      await POST(
        new Request("http://localhost/api/places/search", {
          method: "POST",
          body: "{bad",
        }),
      )
    ).status,
    400,
  );
  assert.equal(
    (await POST(request({ name: "A", city: "B", extra: "x".repeat(5000) })))
      .status,
    413,
  );
});
test("missing key is an explicit unavailable response with no sample substitutes", async () => {
  const before = process.env.GOOGLE_PLACES_API_KEY;
  delete process.env.GOOGLE_PLACES_API_KEY;
  try {
    const response = await POST(request({ name: "A", city: "SF" }));
    assert.equal(response.status, 503);
    const data = await response.json();
    assert.equal(data.configured, false);
    assert.equal(data.candidates, undefined);
  } finally {
    if (before) process.env.GOOGLE_PLACES_API_KEY = before;
  }
});
test("Places adapter uses a narrow mask, validates output, and surfaces provider failure (mocked)", async () => {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  const originalFetch = globalThis.fetch;
  process.env.GOOGLE_PLACES_API_KEY = "test-only-fake-key";
  try {
    globalThis.fetch = async (input, init) => {
      assert.equal(input, "https://places.googleapis.com/v1/places:searchText");
      const headers = new Headers(init?.headers);
      assert.equal(
        headers.get("X-Goog-FieldMask"),
        "places.id,places.displayName,places.formattedAddress,places.location,places.attributions",
      );
      assert.equal(headers.get("X-Goog-Api-Key"), "test-only-fake-key");
      assert.equal(init?.cache, "no-store");
      return Response.json({
        places: [
          {
            id: "candidate",
            displayName: { text: "A" },
            formattedAddress: "Mock address",
            location: { latitude: 1, longitude: 2 },
          },
        ],
      });
    };
    let response = await POST(request({ name: "A", city: "SF" }));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    assert.equal((await response.json()).candidates[0].id, "candidate");
    globalThis.fetch = async () => Response.json({ places: [{ id: 123 }] });
    assert.equal((await POST(request({ name: "A", city: "SF" }))).status, 502);
    globalThis.fetch = async () =>
      new Response("Provider failed", { status: 500 });
    response = await POST(request({ name: "A", city: "SF" }));
    assert.equal(response.status, 502);
    assert.equal((await response.json()).candidates, undefined);
    globalThis.fetch = async () => {
      throw new Error("timeout");
    };
    assert.equal((await POST(request({ name: "A", city: "SF" }))).status, 502);
  } finally {
    globalThis.fetch = originalFetch;
    if (key) process.env.GOOGLE_PLACES_API_KEY = key;
    else delete process.env.GOOGLE_PLACES_API_KEY;
  }
});
