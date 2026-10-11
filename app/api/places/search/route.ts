import { NextResponse } from "next/server";
import { z } from "zod";
import { searchPlacesText } from "@/lib/places";
const input = z
  .object({
    name: z.string().trim().min(1).max(120),
    city: z.string().trim().min(1).max(120),
  })
  .strict();
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
  const result = await searchPlacesText(`${data.data.name}, ${data.data.city}`);
  if (!result.configured)
    return NextResponse.json(
      {
        error:
          "Google Places is not configured. Save this place without a match, or use the sample demo.",
        configured: false,
      },
      { status: 503 },
    );
  if (result.error)
    return NextResponse.json(
      {
        error:
          result.error === "provider"
            ? "Google Places could not complete the search. Save without a match and try again later."
            : "Google Places timed out or returned an invalid response. You can keep using saved places.",
      },
      { status: 502 },
    );
  return NextResponse.json(
    { candidates: result.candidates, configured: true },
    { headers: { "Cache-Control": "no-store" } },
  );
}
