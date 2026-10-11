import { z } from "zod";

const googlePlace = z.object({
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

export type GooglePlaceCandidate = z.infer<typeof googlePlace>;
export type PlaceHit = {
  id: string;
  name: string;
  address: string;
  latitude?: number;
  longitude?: number;
};

export function mapsSearchCitation(name: string, city: string, address = "") {
  const query = [name, address || city].filter(Boolean).join(", ");
  return {
    url: `https://www.google.com/maps/search/?${new URLSearchParams({ api: "1", query })}`,
    title: `${name} on Google Maps (unverified)`,
  };
}

export async function searchPlacesText(
  textQuery: string,
  options: {
    location?: { latitude: number; longitude: number } | null;
    signal?: AbortSignal;
  } = {},
) {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) return { configured: false as const, candidates: [] as GooglePlaceCandidate[], hits: [] as PlaceHit[] };
  const query = textQuery.trim().slice(0, 256);
  if (!query) return { configured: true as const, candidates: [] as GooglePlaceCandidate[], hits: [] as PlaceHit[] };
  try {
    const body: Record<string, unknown> = { textQuery: query, pageSize: 3 };
    if (options.location) {
      body.locationBias = {
        circle: {
          center: {
            latitude: options.location.latitude,
            longitude: options.location.longitude,
          },
          radius: 3500,
        },
      };
    }
    const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask":
          "places.id,places.displayName,places.formattedAddress,places.location,places.attributions",
      },
      body: JSON.stringify(body),
      signal: options.signal || AbortSignal.timeout(8000),
      cache: "no-store",
    });
    if (!response.ok) {
      return { configured: true as const, candidates: [] as GooglePlaceCandidate[], hits: [] as PlaceHit[], error: "provider" as const };
    }
    const output = z.object({ places: z.array(googlePlace).max(3).optional() }).parse(await response.json());
    const candidates = output.places || [];
    const hits = candidates
      .map((place) => ({
        id: place.id,
        name: place.displayName?.text || "",
        address: place.formattedAddress || "",
        latitude: place.location?.latitude,
        longitude: place.location?.longitude,
      }))
      .filter((hit) => hit.name);
    return { configured: true as const, candidates, hits };
  } catch {
    return { configured: true as const, candidates: [] as GooglePlaceCandidate[], hits: [] as PlaceHit[], error: "invalid" as const };
  }
}
