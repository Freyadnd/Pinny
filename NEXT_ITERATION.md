# Next iteration goals — deferred from the published baseline

These goals are preserved from the published baseline. This iteration adds a server-side live AI/web path and an action-only current-location control without rebuilding the app. Live provider verification is still pending because no OpenAI key was available; see README and LIVE_CHECKLIST.md.

- Minimal voice-led interaction without mandatory forms.
- Real AI conversation with contextual follow-ups.
- Explicit current-location permission.
- Web research for current context, such as SF Restaurant Week.
- Tinder-style restaurant selection.
- Plans/calendar and visit-feedback prompts.
- Personalization from actual saved inspiration and visit experiences.
- User-triggered social-save import; investigate a browser extension first.

The keyless sample and explicitly selected saved-only experiences keep deterministic parsing. Personal/live mode now has bounded OpenAI interpretation, optional official web search, cited research cards, contextual plan/time actions, and stored personal preferences/visit feedback. Google Maps links, confirmed `.ics` export, existing browser data, and Pinny-only JSON transfer remain supported. Swipe UI, social extensions/import, account sync, background detection and automatic booking stay deferred.
