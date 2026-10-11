import Link from "next/link";
export default function Terms() {
  return (
    <main className="legal">
      <Link href="/">← Back to Pinny</Link>
      <h1>Terms of use</h1>
      <p>
        Pinny is an experimental outing planner. Sample budgets, notes, and tags
        are illustrative. Activity durations are estimates and exclude travel.
        Check the actual destination, opening hours, accessibility, cost, and
        conditions before leaving.
      </p>
      <p>
        Your saved links and notes are your responsibility. Recommendations
        use personal data and optionally sourced web research. Sources may be incomplete or stale; confirm dates, menus, costs, noise, and availability with the venue. No reservation or popularity guarantee is made. Calendar export requires your confirmation and never syncs automatically.
      </p>
      <h2>Google services</h2>
      <p>
        Use of optional Google Places and Google Maps is subject to{" "}
        <a
          href="https://policies.google.com/terms"
          target="_blank"
          rel="noopener noreferrer"
        >
          Google’s Terms of Service
        </a>{" "}
        and the{" "}
        <a
          href="https://maps.google.com/help/terms_maps/"
          target="_blank"
          rel="noopener noreferrer"
        >
          Google Maps / Google Earth Additional Terms of Service
        </a>
        . Google-derived information belongs to its respective providers.
      </p>
      <h2>Your data</h2>
      <p>
        Data is stored locally without a backup service. The prototype is
        provided as-is without guarantees. Resetting a workspace or clearing
        browser storage deletes its saved records.
      </p>
      <p>Last updated October 11, 2026.</p>
    </main>
  );
}
