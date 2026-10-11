# Three-minute Pinny demo

1. Start `npm run dev` and open http://localhost:3000. Ensure **Sample workspace** is active. Reset it explicitly in settings if needed.
2. Show the prominent microphone. Type or speak `I want spicy food alone under $25.` Edit voice transcription before sending. Two **Sample** cards appear, with your sample estimate, saved reason, and source references.
3. Say `The second one, then a walk.` Two grounded stops form a plan. On phone, expand **Your plan** above the composer. Directions use Google Maps; unmatched destinations must be verified.
4. Say `Make it tonight at six.` Read the full date, time, and timezone. Press **Confirm time**, then **Export .ics**. Open the download in your calendar app; no account sync happens.
5. Say `I went. Great food, but too noisy.` Pinny saves a personal note for the primary place without inventing a rating.
6. Refresh. Show that plan, conversation, and note remain. Ask for `quiet spicy food` to see the personal noise note influence matches.
7. Open **Your inspiration**. Edit a reason, delete a place, close the drawer, and press **Undo** to restore it and its experience.
8. Switch to **my places** from settings. The workspace is empty and independent. Paste a TikTok URL; Pinny asks for name/city. Reply `Coffee Nook in San Francisco for quiet coffee around $9`. The link is a reference, not extracted content.

# Manual checks

- [ ] Actual microphone: start only on click, listening indication, editable transcription, stop, no automatic send.
- [ ] Real browser denied microphone: clear denial in browser settings or keep typing; unsupported browsers still allow text.
- [ ] Real denied geolocation: settings → Use my location; manual city input works regardless.
- [ ] Calendar import: timezone/date/end time look right; activity duration excludes travel.
- [ ] Real Google Maps navigation: unknown names open lookup/directions that you verify; confirmed place IDs target the chosen match.
- [ ] If credentials are supplied: Google success, candidate confirmation, required attributions, refresh matching, rejected duplicate ID, invalid key, timeout. Do not substitute samples.
- [ ] Browser private/storage-blocked mode: warning is visible and keyless demo works in-session; don't expect persistence.
- [ ] Delete all sample places, refresh: remains empty. Only **Reset demo** reseeds it.
- [ ] Personal workspace stays separate from sample data. Returning to either restores its own context.
- [ ] Keyboard navigation and visible focus. Escape closes inspiration/settings. Check mobile keyboard visibility on a physical phone.
- [ ] In **my places**, settings → Export JSON; transfer the file to phone → Import JSON → Confirm import. Existing notes and plans remain; sample backups are rejected. Localhost data does not move automatically.

Automated browser checks covered the full text journey, an actual `.ics` download, safe Maps link parameters, refresh, edit/delete/undo, missing-key provider errors, 1440px desktop and 390px phone overflow, plus simulated speech and location states. Actual external services and hardware require the checks above.
