import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { agentInputSchema, isAgentFailure, runAgent } from "@/lib/agent";
export const runtime = "nodejs";
export const maxDuration = 60;
const counts = new Map<string, { count: number; expires: number }>();
const json = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
function safeFailure(category: string) {
  switch (category) {
    case "origin_rejected": return { error: "Use Pinny from its own site.", code: category };
    case "request_too_large": return { error: "Context is too large.", code: category };
    case "request_invalid": return { error: "Send a valid Pinny request.", code: category };
    case "request_invalid_context": return { error: "The conversation context is invalid or too large. Your data has been kept.", code: category };
    case "sample_data_rejected": return { error: "Sample places cannot be sent to live research.", code: category };
    case "provider_not_configured": return { error: "Live AI is not configured on this server.", code: category };
    case "rate_limited": return { error: "Please wait a minute before another AI request.", code: category };
    case "provider_api_error": return { error: "The AI provider request failed. Check server configuration and retry.", code: category };
    case "malformed_model_output": return { error: "The AI response could not be read. Retry the request.", code: category };
    case "web_search_failed": return { error: "Web research did not return usable sources. Retry or ask without current research.", code: category };
    case "action_validation_failed": return { error: "The AI response did not pass Pinny’s safety checks. Your data was kept; retry the request.", code: category };
    case "request_timeout": return { error: "Live research exceeded Pinny’s 55-second request limit. Retry with a shorter request.", code: category };
    default: return { error: "Pinny could not complete this request. Your data was kept; retry.", code: "internal_agent_error" };
  }
}
export async function POST(request: Request) {
  const requestId = randomUUID();
  const fail = (status: number, stage: string, category: string, errorClass: string, errorCode: string) => {
    const failure = safeFailure(category);
    console.error(JSON.stringify({ requestId, stage, errorClass, errorCode }));
    return json({ ...failure, requestId, dataChanged: false }, status);
  };
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      // Next's internal URL can use localhost behind a proxy even when the
      // browser uses a LAN address. Compare the actual HTTP host instead.
      const url = new URL(origin);
      if (!["http:", "https:"].includes(url.protocol) || url.host !== (request.headers.get("host") || new URL(request.url).host)) return fail(403, "origin_validation", "origin_rejected", "RequestValidationError", "origin_mismatch");
    } catch { return fail(403, "origin_validation", "origin_rejected", "RequestValidationError", "origin_invalid"); }
  }
  if (Number(request.headers.get("content-length") || 0) > 131072) return fail(413, "request_validation", "request_too_large", "RequestValidationError", "content_length_limit");
  let parsed;
  try {
    const body = await request.text();
    if (new TextEncoder().encode(body).length > 131072) return fail(413, "request_validation", "request_too_large", "RequestValidationError", "body_size_limit");
    parsed = agentInputSchema.safeParse(JSON.parse(body));
  } catch { return fail(400, "request_validation", "request_invalid", "RequestValidationError", "json_parse_failed"); }
  if (!parsed.success) return fail(400, "request_validation", "request_invalid_context", "ZodError", "request_schema_invalid");
  if ([...parsed.data.state.places, ...parsed.data.state.research].some((p) => p.sample)) return fail(400, "request_validation", "sample_data_rejected", "RequestValidationError", "sample_data_present");
  const key = process.env.OPENAI_API_KEY;
  if (!key) return fail(503, "configuration", "provider_not_configured", "ConfigurationError", "openai_key_missing");
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0] || "local";
  const now = Date.now();
  for (const [id, entry] of counts) if (entry.expires < now) counts.delete(id);
  const counter = counts.get(ip) || { count: 0, expires: now + 60000 };
  if (counter.count >= 5 || counts.size >= 1000) return fail(429, "rate_limit", "rate_limited", "RateLimitError", "request_limit_reached");
  counter.count++; counts.set(ip, counter);
  const deadline = AbortSignal.timeout(55000);
  let stage = "intent";
  try {
    const signal = AbortSignal.any([request.signal, deadline]);
    return json(await runAgent(parsed.data, key, signal, undefined, (next) => { stage = next; }));
  } catch (error) {
    const agentFailure = isAgentFailure(error) ? error : null;
    const category = deadline.aborted ? "request_timeout" : agentFailure?.category || "internal_agent_error";
    const errorClass = agentFailure ? agentFailure.safeErrorClass : error instanceof Error ? "Error" : "UnknownError";
    const errorCode = agentFailure?.safeCode || (deadline.aborted ? "request_deadline_exceeded" : "unclassified_error");
    const status = category === "request_timeout" ? 504 : 502;
    return fail(status, agentFailure?.stage || stage, category, errorClass, errorCode);
  }
}
