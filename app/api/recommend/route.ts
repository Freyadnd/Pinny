import { NextResponse } from "next/server";
import OpenAI from "openai";
import { agentInputSchema, runAgent } from "@/lib/agent";
export const runtime = "nodejs";
export const maxDuration = 60;
const counts = new Map<string, { count: number; expires: number }>();
const json = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
function safeProviderFailure(error: unknown) {
  if (error instanceof OpenAI.APIError) {
    if (error instanceof OpenAI.APIConnectionTimeoutError) return { error: "OpenAI timed out. Retry the request.", code: "provider_timeout" };
    switch (error.status) {
      case 400: return { error: "OpenAI rejected the model request or response schema. Check the configured model and request settings.", code: "provider_bad_request" };
      case 401: return { error: "OpenAI rejected the configured API key. Check the Production key in Vercel.", code: "provider_authentication" };
      case 403: return { error: "The OpenAI project does not have access to this model or capability.", code: "provider_forbidden" };
      case 404: return { error: "The configured OpenAI model or endpoint was not found.", code: "provider_not_found" };
      case 429: return { error: "OpenAI rate limit or project quota was reached. Check project limits and retry.", code: "provider_rate_limit" };
      default: return { error: "OpenAI could not complete the request. Retry shortly.", code: "provider_error" };
    }
  }
  if (error instanceof Error && error.name === "TimeoutError") return { error: "Live research exceeded Pinny’s 55-second request limit. Retry with a shorter request.", code: "request_timeout" };
  return { error: "Live AI/research returned an invalid action or failed before a provider response. Your data was kept; retry or choose saved-only mode.", code: "invalid_provider_response" };
}
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      // Next's internal URL can use localhost behind a proxy even when the
      // browser uses a LAN address. Compare the actual HTTP host instead.
      const url = new URL(origin);
      if (!["http:", "https:"].includes(url.protocol) || url.host !== (request.headers.get("host") || new URL(request.url).host)) return json({ error: "Use Pinny from its own site." }, 403);
    } catch { return json({ error: "Use Pinny from its own site." }, 403); }
  }
  if (Number(request.headers.get("content-length") || 0) > 131072) return json({ error: "Context is too large." }, 413);
  let parsed;
  try {
    const body = await request.text();
    if (new TextEncoder().encode(body).length > 131072) return json({ error: "Context is too large." }, 413);
    parsed = agentInputSchema.safeParse(JSON.parse(body));
  } catch { return json({ error: "Send a valid Pinny request." }, 400); }
  if (!parsed.success) return json({ error: "The conversation context is invalid or too large. Your data has been kept." }, 400);
  if ([...parsed.data.state.places, ...parsed.data.state.research].some((p) => p.sample)) return json({ error: "Sample places cannot be sent to live research." }, 400);
  const key = process.env.OPENAI_API_KEY;
  if (!key) return json({ error: "Live AI is not configured. Add OPENAI_API_KEY on the server, or explicitly choose saved-only mode or the sample demo.", code: "not_configured" }, 503);
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0] || "local";
  const now = Date.now();
  for (const [id, entry] of counts) if (entry.expires < now) counts.delete(id);
  const counter = counts.get(ip) || { count: 0, expires: now + 60000 };
  if (counter.count >= 5 || counts.size >= 1000) return json({ error: "Please wait a minute before another AI request." }, 429);
  counter.count++; counts.set(ip, counter);
  const deadline = AbortSignal.timeout(55000);
  try {
    const signal = AbortSignal.any([request.signal, deadline]);
    return json(await runAgent(parsed.data, key, signal));
  } catch (error) {
    // Never log prompts, credentials, precise location, or upstream response bodies.
    if (deadline.aborted) return json({ error: "Live research exceeded Pinny’s 55-second request limit. Retry with a shorter request.", code: "request_timeout", dataChanged: false }, 504);
    const failure = safeProviderFailure(error);
    return json({ ...failure, dataChanged: false }, failure.code === "request_timeout" || failure.code === "provider_timeout" ? 504 : 502);
  }
}
