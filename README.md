# Pinny

A voice-led personal outing companion: tell Pinny your mood, choose from your saved inspiration, make a short plan, export a confirmed calendar event, and remember how it went.

The repository was initially empty. This MVP creates a Next.js App Router scaffold with TypeScript, Tailwind 4, Zod, and browser-local persistence. It has one primary conversation screen and a secondary inspiration drawer, with a desktop plan panel and a collapsible plan on smaller screens. All interface copy is English.

## Run locally

Requires Node.js 20.9+ and npm (validated with Node 22).

```sh
npm install
npm run dev
```

Open http://localhost:3000. No credentials are needed. Start in **Sample workspace**, or use the workspace badge/settings to switch to your own places.

```sh
npm run lint
npm run typecheck
npm test
npm run build
npm run start
```

Avoid running the development server while producing or serving a production build, since both use `.next`.
The build script uses Next's supported webpack builder; the local Turbopack CSS worker encountered a permission failure in this environment.

## The conversational journey

Try these messages in the sample workspace:

1. `I want spicy food alone under $25.`
2. `The second one, then a walk.`
3. `Make it tonight at six.`
4. Review the exact date, time, and timezone. Press **Confirm time** (or say `Confirm`).
5. Download **Export .ics** and open the file in your calendar app.
6. Use each stop's Maps arrow to find directions. For unmatched names, verify the destination in Maps.
7. `I went. Great food, but too noisy.`
8. Refresh: the conversation, current plan, confirmed time, and personal note remain.

Voice is browser-dependent. Press the microphone to start, press again to stop, edit the transcription, then send. Transcription never sends automatically. Text always works. HTTPS or localhost is generally needed for browser permissions. Browser speech services may process audio remotely; Pinny does not store audio.

Pinny understands coffee, walks, food, spicy meals, solo/group context, city/neighborhood, dollar budgets, activity-time limits, first/second option follow-ups, simple plan changes (`remove the walk`), and dates such as tonight, tomorrow, named weekdays, or `2026-10-15 at 6 pm`. A bare weekday means its next occurrence. Times without clear am/pm prompt one follow-up question; “tonight at six” means 6 pm. Dates/times use the browser's timezone and always need confirmation. A time in the past is flagged for review.

The phrases above describe the keyless demo and explicitly selected saved-only engine. The personal live engine uses OpenAI interpretation and contextual follow-ups rather than these rules. Missing/failed live providers produce a visible error; choosing saved-only or sample mode is explicit, never automatic.

## Save inspiration without mandatory forms

Use **Your inspiration → Tell Pinny about a place**, or simply type:

```text
Save The Mill in San Francisco for coffee and toast, around $15 https://www.themillsf.com/
```

Name and city are necessary. A pasted TikTok/Rednote link alone is kept in the conversation while Pinny asks for the name and city. Pinny never claims it read or extracted the post. Source URLs must be http/https and open with safe external-link behavior.

To add **your own places**, click the workspace badge at the top (or **Workspace settings** in the desktop sidebar), choose **Switch to my places**, and close the drawer. Type in the always-available input, or open **Your inspiration → Tell Pinny about a place**. That button drafts `Save ` in the input; complete it and send.

Accepted save syntax is `Save NAME in CITY for REASON around $AMOUNT URL`. `Remember` or `Add` can replace `Save`; `because` can replace `for`; `about`, `under`, or `budget` can introduce a numeric user estimate. Reason, estimate, and URL are optional. `in` separates the name and city. Keep the city spelling consistent across places and requests. Examples:

```text
Save Sichuan Home in San Francisco for spicy solo food around $22 https://example.com/my-reference
Save Alamo Square in San Francisco for a walk outdoors around $0
Save Saint Frank Coffee in San Francisco for quiet coffee around $8
```

These are syntax examples, not verified venue facts or prices. Use your own estimates. Supported keyword tags include `coffee`, `spicy`, `solo`, `quiet`, `walk`, `dinner`, `group`, and `outdoors`; unsupported categories may not be recommended. There is no arbitrary-name/city editor or automatic address lookup. In sample/saved-only parsing the city has to follow `in`; long complex sentences and place names containing that separator can parse incorrectly. Check the saved drawer after saving. Numeric budgets exclude unknown-price places; say `no budget` to clear a recommendation budget. Save walks with a user estimate of `$0` if you want them eligible under a numeric budget. Visit notes need a selected place or its explicit saved name. Duplicate-save merging adds notes/links but does not update existing tags or price estimates.

For your first personal recommendation, include the location: `I want spicy food alone in San Francisco under $25.` Saving a city's place does not automatically set your request location. If it is missing, Pinny asks which city; answer `San Francisco`. Later follow-ups retain that context.

## Transfer your own data between desktop and phone

Localhost and the deployed domain have separate browser storage. Different devices also have separate data, even on the same domain. Nothing transfers automatically.

1. On desktop, switch to **my places** and open workspace settings.
2. Press **Export JSON**. Save `pinny-personal-backup.json` and transfer it to your phone using Files, AirDrop, or another method you choose.
3. On your phone, open the deployed Pinny URL, switch to **my places**, open workspace settings, and press **Import JSON**.
4. Choose the file, review the record counts, and press **Confirm import**. Close the drawer; **Undo** can reverse the import until refresh or a subsequent change.

Only Pinny personal backups up to 2 MB are accepted. Imports validate the version/schema and reject sample fixtures. Places match by confirmed Google place ID or normalized name/city; notes, tags, and reference links are combined, existing estimates are retained, and identical experience records are not duplicated. An existing plan/settings remain; an empty workspace adopts the imported plan/settings. The file contains private notes and experiences: keep it private. Conversation history, raw GPS, audio, Google enrichment, and credentials are not exported. Personal preferences are transferred too; legacy backups remain accepted. This is manual backup transfer of Pinny's own data, not social-platform extraction or ongoing sync.

Your stated reason, simple recognized tags/category, links, and optional user estimate are kept internally as structured data. Name/city duplicates offer an explicit “merge inspiration” follow-up. The inspiration drawer permits optional note editing and deletion; **Undo** restores the last change, including deleted experiences. Undo is in-memory and disappears after refresh or switching modes. Other inspiration updates can be made by saving the same place and merging notes/links.

Spoken visit feedback is a personal note attached to the chosen primary place. Mention a saved place's name to explicitly associate feedback with it. No numerical personal rating is inferred. Live mode can also remember explicit general preferences such as “Remember that I prefer quieter restaurants.” Existing authored ratings from the earlier data model are preserved. Notes containing “noisy”/“loud” lower that place's future rank and exclude it from quiet requests; this is limited keyword matching, not sentiment analysis.

## Modes and grounded data

- **Sample workspace:** complete keyless journey, real names for Maps lookup, clearly marked sample notes, tags, budgets, and reference links. Illustrations are decorative and do not depict actual venues. Fixture budgets are not verified prices. Generic TikTok/Rednote homepage references are placeholders, not real reviewed recommendations. Samples are seeded once on first use. Deleting all places never reseeds; **Workspace settings → Reset demo** is explicit.
- **Personal/live workspace:** uses saved inspiration, personal preferences and visits plus current research when configured. It can discover sourced venues beyond fixtures. Recommendations initially live in a separate research list; selecting a plan/recording a visit retains the chosen place. Without a key, a visible failure offers explicit saved-only mode. Samples are never mixed in. Unknown prices are not evidence of budget fit; estimates and sourced menu claims are separate.
- **Optional Google matching:** independently configured on demand. It never powers nearby discovery and never silently substitutes sample places on failure.
- **AI:** optional server-side OpenAI Responses API. `OPENAI_API_KEY` enables it; `OPENAI_MODEL` defaults to `gpt-5.4-mini`, whose official documentation supports web search and structured output. A configured badge indicates variable availability, not a health check.

Sample/saved-only modes have no verified reviews, ratings, hours or menus. Live mode can cite primary sources for current event/venue/menu information; atmosphere and popularity remain unknown without supporting evidence. There are no bookings or reservation guarantees. Recommendations use saved reasons/tags/categories, location text, user price estimates, and personal experience notes. Activity durations are estimates; they exclude travel. Stop order is not route optimization. No embedded map, login, database, automatic import, direct calendar sync, offline service worker, or universal installation promise.

## Live AI and current web context

Local setup (keep secrets out of commits):

1. Copy `.env.example` to `.env.local` if you do not already have a local file. Preserve any existing values.
2. In your editor set `OPENAI_API_KEY` to your own API key and `OPENAI_MODEL=gpt-5.4-mini`. Never use a `NEXT_PUBLIC_` variable. These variables are read only by server routes.
3. Restart `npm run dev`. Open personal workspace and select **Use live AI** if you previously chose saved-only mode.
4. Try a request. An **AI configured** badge is not proof the key works; a successfully returned sourced recommendation is the real check. Model/account access, billing and web-search quotas must permit the request.

Existing Vercel setup:

1. Open [Pinny environment settings](https://vercel.com/freyadnds-projects/pinny/settings/environment-variables).
2. Add `OPENAI_API_KEY` as a sensitive server variable and `OPENAI_MODEL` with value `gpt-5.4-mini`. Select Production; add Preview/Development only if you want those environments enabled.
3. In Deployments, redeploy the latest deployment so the new variables take effect (or run `vercel deploy --prod --yes --scope freyadnds-projects` from this linked repository).
4. Open https://pinny-rouge.vercel.app, select personal/live mode, and test a request. Google can remain unconfigured.

The flow uses the official OpenAI SDK: intent structured output → optional hosted `web_search` with real internet access → structured outing action. Ordinary selection/time/feedback follow-ups can skip search. New venue discovery, closer alternatives, current events and stale factual evidence need research. Primary organizer/venue/park sources are requested; an SF Restaurant Week date range must have an organizer citation and is compared to the proposed local outing date in code. Dates outside the range prompt an event-date outing or a normal evening. No dates or event editions are hardcoded. Atmosphere/popularity judgments are not guaranteed facts. With inadequate evidence Pinny should say so and return fewer options.

Source URLs come only from actual retrieval annotations/source lists, never model-authored URLs. Structured model output refers to indexed source IDs. Candidate IDs, duplicate stops, activity budget, event range, local calendar time and user feedback are validated before atomic application. Research records and event evidence are signed server-side for reuse; altered/old-key metadata is not trusted as retrieval evidence. Brief summaries, citation metadata and research timestamps persist locally; raw pages and Google API enrichment do not. Models can still misunderstand evidence; citations and timestamps let you check it. Existing menu/hours facts require refresh when stale (24-hour guidance), and a simple plan/time follow-up does not reverify availability.

Calls use `store:false`, no retries, at most three Responses requests and three built-in tool calls in the research step, bounded output tokens and a 55-second total execution deadline. Requests are limited to 128 KiB, 2,000 user characters, 40 selected saved places, 40 recent notes, and 16 recent messages sent by the client (server maximum 20). Larger libraries remain stored locally; only relevant bounded context is sent. Notes/pages/history are explicitly untrusted, not system instructions. No prompts, secrets, GPS or upstream errors are logged by application code. Same-origin browser requests and best-effort in-process per-IP throttling reduce misuse; these are not distributed production abuse protection. Configure provider spend limits and Vercel WAF/rate limits before sharing widely.

Missing key, inaccessible model, timeout, retrieval without sources or invalid actions produce a visible error and keep all data/plan intact. Input is restored for retry; switching to saved-only or sample mode is explicit. No calendar write, booking, deletion, rating inference or social-post extraction is an AI capability. Confirming a displayed time and downloading `.ics` still happen locally under your control.

**Live verification status:** no local or Vercel OpenAI credentials were available during this iteration. SDK/API calls, citations, follow-ups and error handling were validated with clearly mocked responses; these are not successful live API requests. Real scenarios A/B/C require the setup above. Use [LIVE_CHECKLIST.md](./LIVE_CHECKLIST.md).

Official references checked: [Responses API](https://developers.openai.com/api/reference/resources/responses/methods/create), [web search and retrieval sources](https://developers.openai.com/api/docs/guides/tools-web-search), [structured output](https://developers.openai.com/api/docs/guides/structured-outputs), [GPT-5.4 Mini tool support](https://developers.openai.com/api/docs/models/gpt-5.4-mini).

## Optional Google Places

Copy `.env.example` to `.env.local`, set `GOOGLE_PLACES_API_KEY`, and restart the server. Enable Places API (New), configure billing and suitable API-key restrictions, and set a Google Cloud quota/budget appropriate to the deployment.

In **Personal workspace → Your inspiration**, choose **Find Google match** on a saved place. `POST /api/places/search` validates name/city with Zod, limits input to 4 KiB, uses plain fetch, an 8-second timeout, and a narrow field mask (`id`, `displayName`, `formattedAddress`, `location`, and required `attributions`). Up to three candidates are displayed with Google Maps attribution. You must confirm a candidate; duplicate confirmed IDs are rejected rather than guessed or auto-merged.

Only the confirmed place ID is persisted. Returned Google names, addresses, coordinates, and attributions remain transient in the drawer and are cleared on close. Rematching refreshes the enrichment when needed. No Google reviews or photos are requested. Current location is requested only on user action near the input or in settings. Precise coordinates stay in tab memory for Maps; nearby/closer live requests share a position rounded to roughly 100 meters with the server/OpenAI. It is never saved in localStorage. The compact chip shows the active area and clears GPS context when edited. Denied permission, timeout and unavailable location permit typed city/neighborhood fallback. Straight-line positions do not become walking-time promises.

Public `/privacy` and `/terms` pages link Google's policies and terms. Review these pages and add operator contact information before a public launch. Review current [Google Places policies](https://developers.google.com/maps/documentation/places/web-service/policies) and the [place ID guidance](https://developers.google.com/maps/documentation/places/web-service/place-id) for your deployment. Google Maps attribution uses the permitted plain-text fallback. The matching route has no production abuse protection beyond bounded requests; public deployments should add platform-level rate limits and provider quotas.

**No live Google request was verified with credentials.** Missing-key failures and client failure behavior were tested. Do not interpret “configured” as a successful provider health check.

## Persistence and reused code

`lib/model.ts`, `lib/demo.ts`, `lib/recommend.ts`, Maps helpers, the Google server route, and the persistence adapter were reused from the first implementation. The existing `pinny:demo:v1` and `pinny:live:v1` keys are kept. The schema adds defaulted conversation/context/schedule fields and makes new experience ratings optional, retaining existing ratings and user-authored data.

Data is validated before loading/saving. Existing storage is not rewritten during hydration; only a missing namespace is initialized. Legacy personal history is retained even when its old place reference is missing. Malformed/unknown-version data is preserved and automatic writes disabled until an explicit reset. Quota and denied-storage failures leave changes in memory with a visible warning. A second-tab storage change blocks conversational writes and requests a reload rather than overwriting newer data. Workspace mode is kept separately under `pinny:mode`. There is no backend backup or cross-device sync. Clearing site data deletes local records. No raw Google enrichment is persisted.

## Validation

`npm test` covers ranking constraints, unknown budgets, activity capacity, unsupported intent, demo seeding, malformed/blocked storage, v1 compatibility, the complete follow-up journey, personal memories, explicit merging, URL safety, Maps encoding, ambiguous dates, calendar confirmation invalidation, and constraint-only follow-ups.

A headless Chrome check on the production server verified saving → options → follow-up plan → Maps URLs → confirmed actual `.ics` download → experience → refresh, note editing, delete/undo, workspace separation, missing-key provider behavior, and no horizontal overflow at 1440px/390px. Additional browser checks covered an empty demo surviving refresh, explicit reset, malformed storage preservation, session-only blocked storage, and protection against a real browser storage event from another document. Browser API mocks verified listening, editable transcription without auto-submit, unsupported/denied speech, and denied geolocation. Actual microphone transcription, real GPS, calendar-app import, and credentialed Google success require manual verification. See [DEMO.md](./DEMO.md).

The installed dependency audit reported a development-only `braces` advisory propagated through Next's ESLint/glob dependencies. Runtime dependency audit has no reported vulnerabilities. Avoid exposing development tooling to untrusted glob patterns and review upstream updates before a production launch.

## Deploy

1. Run lint, typecheck, tests, and build.
2. Deploy the repository to a Node-capable Next.js host (for example, Vercel), using `npm run build`. On a Node host, run `npm run start` with the platform's `PORT` setting.
3. Leave environment variables empty for a keyless demo. Add the Google key server-side only if needed; never use a `NEXT_PUBLIC_` prefix for a secret.
4. Serve over HTTPS for microphone/location access, publish the privacy/terms pages, set provider quotas/platform rate limits, and manually verify permissions on supported browsers.
5. Existing browser data is origin-specific and will not transfer from localhost to the deployed domain. Manifest, 192/512 PNG icons, and Apple touch icon are included. Install affordances depend on the browser; no offline support is claimed.

The publication baseline targets only `https://github.com/Freyadnd/Pinny`; unrelated history must never be pushed or force-replaced. Deferred product goals are recorded in [NEXT_ITERATION.md](./NEXT_ITERATION.md).
