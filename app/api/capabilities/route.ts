import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export function GET() {
  return NextResponse.json(
    { googlePlaces: !!process.env.GOOGLE_PLACES_API_KEY, ai: false },
    { headers: { "Cache-Control": "no-store" } },
  );
}
