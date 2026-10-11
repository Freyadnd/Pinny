import Link from "next/link";
export default function Privacy() {
  return (
    <main className="legal">
      <Link href="/">← Back to Pinny</Link>
      <h1>Privacy policy</h1>
      <p>
        Pinny is a hackathon prototype. Your places, links, notes, personal
        visits, preferences, research citations, settings, and plan are saved in your browser’s local storage. Demo
        and personal workspaces are separate. There is no account or database.
        Clearing browser data removes these records.
      </p>
      <h2>Live AI and web research</h2>
      <p>In the personal live workspace, sending a request shares bounded conversation, relevant saved place notes, preferences, visit feedback, and plan context through our server with OpenAI. Current facts may use OpenAI web search. Notes and links are treated as untrusted data, not instructions. We request API responses with storage disabled; OpenAI’s own data policies still apply. Sample and explicitly selected saved-only mode do not call AI. Source summaries and citations can be saved locally; no raw web pages are stored.</p>
      <h2>Optional Google Places</h2>
      <p>
        Only when you choose “Find Google match,” the name and city you enter
        are sent through our server to Google Places. Only a confirmed place ID
        is saved. Returned addresses and coordinates are transient and are
        cleared when the form closes. Google services are governed by the{" "}
        <a
          href="https://policies.google.com/privacy"
          target="_blank"
          rel="noopener noreferrer"
        >
          Google Privacy Policy
        </a>
        .
      </p>
      <h2>Voice and location</h2>
      <p>
        Microphone and location access start only when you press the
        corresponding button. Voice recognition may use your browser vendor’s
        speech service. Pinny does not save raw audio or current coordinates.
        Precise location stays in memory for the current tab for Maps. Nearby or closer live requests send an approximate position rounded to about 100 meters to our server and OpenAI. Location is never placed in localStorage or JSON backups. Type a city or neighborhood instead or clear the current area at any time.
      </p>
      <h2>External websites</h2>
      <p>
        Maps and inspiration links open external websites with their own
        policies. Pinny does not scrape, download, or read your source posts. No
        source-post extraction is performed. Live requests can research public primary sources.
      </p>
      <p>
        Last updated October 11, 2026. Deployment operators should provide their
        own contact details and review this policy before a public launch.
      </p>
    </main>
  );
}
