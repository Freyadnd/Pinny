import { NextResponse } from "next/server";
import { z } from "zod";
const input = z
  .object({
    name: z.string().trim().min(1).max(120),
    city: z.string().trim().min(1).max(120),
  })
  .strict();
const candidate = z.object({
  id: z.string(),
  displayName: z.object({ text: z.string() }).optional(),
  formattedAddress: z.string().optional(),
  location: z
    .object({ latitude: z.number(), longitude: z.number() })
    .optional(),
  attributions: z
    .array(
      z.object({
        provider: z.string().optional(),
        providerUri: z.string().optional(),
      }),
    )
    .optional(),
});
export async function POST(request: Request) {
  if (Number(request.headers.get("content-length") || 0) > 4096)
    return NextResponse.json(
      { error: "Request is too large." },
      { status: 413 },
    );
  let data;
  try {
    const text = await request.text();
    if (text.length > 4096)
      return NextResponse.json(
        { error: "Request is too large." },
        { status: 413 },
      );
    data = input.safeParse(JSON.parse(text));
  } catch {
    return NextResponse.json(
      { error: "Send valid JSON with a name and city." },
      { status: 400 },
    );
  }
  if (!data.success)
    return NextResponse.json(
      { error: "Name and city are required (up to 120 characters each)." },
      { status: 400 },
    );
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key)
    return NextResponse.json(
      {
        error:
          "Google Places is not configured. Save this place without a match, or use the sample demo.",
        configured: false,
      },
      { status: 503 },
    );
  try {
    const response = await fetch(
      "https://places.googleapis.com/v1/places:searchText",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": key,
          "X-Goog-FieldMask":
            "places.id,places.displayName,places.formattedAddress,places.location,places.attributions",
        },
        body: JSON.stringify({
          textQuery: `${data.data.name}, ${data.data.city}`,
          pageSize: 3,
        }),
        signal: AbortSignal.timeout(8000),
        cache: "no-store",
      },
    );
    if (!response.ok)
      return NextResponse.json(
        {
          error:
            "Google Places could not complete the search. Save without a match and try again later.",
        },
        { status: 502 },
      );
    const output = z
      .object({ places: z.array(candidate).max(3).optional() })
      .parse(await response.json());
    return NextResponse.json(
      { candidates: output.places || [], configured: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      {
        error:
          "Google Places timed out or returned an invalid response. You can keep using saved places.",
      },
      { status: 502 },
    );
  }
}
