# Live iteration acceptance checks

No real OpenAI key was present during implementation. Unit/browser mocks are identified as mocks; they are not live acceptance passes.

## Enable and test real requests

Use README's local/Vercel setup. Personal/live workspace → Use my location, or tell Pinny a city/neighborhood. The default sample workspace never calls OpenAI. A configured badge only checks variable presence.

- **A:** “I'm tired. Find a popular coffee spot nearby where I can sit quietly.” Supply a city/neighborhood or authorize location. Open primary venue citations. Confirm known seating/location versus unknown popularity/noise. Follow with “The second one, but no extra coffee stop. Add a short walk.” Check the selected second ID stays first and there is only one coffee stop; a new walk needs source evidence. “Closer” must use supplied location, not imagined walking times.
- **B:** “Help me plan an evening for SF Restaurant Week.” Open organizer citations and verify the current edition's dates. If today/requested date is outside, choose an event day or a normal evening. Check participating venues/menu claims against primary sources. Choose a plan; “Make it six thirty.” should retain the outing date, suggest 18:30 only in an evening context, and require confirmation before `.ics`. Import the file manually into your calendar.
- **C:** “Remember that I prefer quieter restaurants.” Or choose a place then “I went. Great food, but too noisy.” Ask for a subsequent recommendation and check its explanation uses the preference/visit experience while not guaranteeing noise levels or inventing a rating.
- Deny location, simulate timeout/unavailable, edit location chip and use manual location. GPS must not occur on page load or persist in browser storage/JSON backup. Only nearby/closer requests send approximate coordinates.
- Invalid key/model/provider timeout: visible error, unchanged personal records/current plan, editable retry text, explicit saved-only/sample choices. Never substitute sample venues into live results.
- Mobile keyboard, cards/actions, cited sources, drawer close button and plan expand/collapse on a physical phone. Actual voice transcription remains a browser capability, starts only on tap and never auto-sends.

## Regression

Keyless sample save → recommendation → second + walk → confirmed `.ics` → Maps → feedback → refresh remains working. Personal saved-only save/edit/delete/undo and JSON transfer remain available. Existing localStorage namespaces and legacy authored ratings are preserved.

No Google key is necessary. No direct calendar sync, booking, swipe selection, social extension, account sync or background detection is implemented.
