import Link from "next/link";
export default function Privacy() {
  return (
    <main className="legal">
      <Link href="/">← Back to Pinny</Link>
      <h1>Privacy policy</h1>
      <p>
        Pinny is a hackathon prototype. Your places, links, notes, personal
        visits, settings, and plan stay in your browser’s local storage. Demo
        and personal workspaces are separate. There is no account or database.
        Clearing browser data removes these records.
      </p>
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
        Location stays in memory for the current tab. Type a city or
        neighborhood at any time.
      </p>
      <h2>External websites</h2>
      <p>
        Maps and inspiration links open external websites with their own
        policies. Pinny does not scrape, download, or read your source posts. No
        AI service is used in this version.
      </p>
      <p>
        Last updated October 11, 2026. Deployment operators should provide their
        own contact details and review this policy before a public launch.
      </p>
    </main>
  );
}
