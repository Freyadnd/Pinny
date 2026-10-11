export function PlaceArt({
  type,
  variant = 0,
}: {
  type: string;
  variant?: number;
}) {
  const food = type === "food",
    walk = type === "walk";
  return (
    <svg
      viewBox="0 0 320 140"
      preserveAspectRatio="xMidYMid slice"
      className={`place-art art-${type}`}
      aria-hidden="true"
    >
      <rect
        width="320"
        height="140"
        fill={walk ? "#dce7d9" : food ? "#f1d7c2" : "#e8dfd0"}
      />
      {walk ? (
        <>
          <circle cx="258" cy="32" r="19" fill="#f9eed5" />
          <path d="M0 80 Q55 15 135 78 Q218 24 320 67 V140 H0" fill="#a1bca3" />
          <path
            d="M0 112 Q110 52 180 107 Q240 65 320 105 V140 H0"
            fill="#658a72"
          />
          <path
            d="M140 140 Q225 106 177 86 Q144 70 163 54"
            fill="none"
            stroke="#f6ead4"
            strokeWidth="19"
          />
          <path
            d="M46 100 V35 M27 62 L46 30 L65 62 Z M20 80 L46 42 L72 80 Z"
            fill="#406950"
            stroke="#406950"
            strokeWidth="4"
          />
          <path
            d="M282 114 V57 M267 78 L282 49 L301 78 Z"
            fill="#426a53"
            stroke="#426a53"
            strokeWidth="4"
          />
        </>
      ) : food ? (
        <>
          <path d="M0 105 L320 63 V140 H0" fill="#ddb99b" />
          <ellipse cx="161" cy="83" rx="77" ry="27" fill="#a0654e" />
          <path d="M84 82 Q91 125 160 126 Q231 125 238 82" fill="#f9f1e2" />
          <ellipse cx="161" cy="79" rx="76" ry="26" fill="#fbf3e6" />
          <ellipse cx="161" cy="79" rx="66" ry="20" fill="#c96a42" />
          <path
            d="M125 71 q26 25 36 0 t33 3 M115 83 q19 -20 26 1 t32 0 t31 -3"
            fill="none"
            stroke="#efd4a1"
            strokeWidth="4"
          />
          <path
            d="M132 66 l6 10 M181 87 l10 -8 M149 88 l10 4"
            stroke="#608166"
            strokeWidth="5"
          />
          <path
            d="M203 75 L253 20 M217 79 L267 23"
            stroke="#704f3c"
            strokeWidth="5"
            strokeLinecap="round"
          />
          <path
            d="M111 43 q-8 -10 0 -20 M140 37 q-8 -10 0 -20"
            fill="none"
            stroke="#fff8ef"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <ellipse cx="264" cy="113" rx="20" ry="8" fill="#b68268" />
          <path d="M264 109 q-10 -13 2 -19 q12 5 4 18" fill="#bb5241" />
        </>
      ) : (
        <>
          <path d="M0 102 L320 76 V140 H0" fill="#c6b59c" />
          <ellipse cx="165" cy="116" rx="66" ry="12" fill="#b5a189" />
          <ellipse cx="157" cy="112" rx="57" ry="13" fill="#f8f4eb" />
          <path
            d="M125 58 V95 Q157 119 187 95 V58"
            fill={variant % 2 ? "#6a8574" : "#c7805b"}
          />
          <path
            d="M187 66 Q221 59 215 82 Q209 98 185 93"
            fill="none"
            stroke={variant % 2 ? "#6a8574" : "#c7805b"}
            strokeWidth="9"
          />
          <ellipse cx="156" cy="58" rx="32" ry="10" fill="#f1e5d2" />
          <ellipse cx="156" cy="58" rx="27" ry="7" fill="#694b37" />
          <path d="M148 58 q10 -9 17 0 q-10 9 -17 0" fill="#dfc398" />
          <path
            d="M140 36 q-10 -12 0 -22 M163 31 q-10 -12 0 -22"
            fill="none"
            stroke="#faf8f2"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <rect
            x="35"
            y="83"
            width="62"
            height="40"
            rx="3"
            fill="#f3eddd"
            transform="rotate(-14 35 83)"
          />
          <path
            d="M46 96 L77 88 M49 104 L80 96 M51 113 L70 108"
            stroke="#aaa085"
            strokeWidth="2"
          />
        </>
      )}
    </svg>
  );
}
export function EmptyPlanArt() {
  return (
    <svg viewBox="0 0 250 140" className="empty-plan-art" aria-hidden="true">
      <path
        d="M50 100 Q17 41 100 60 T195 39"
        fill="none"
        stroke="#d6cebd"
        strokeWidth="2"
        strokeDasharray="5 6"
      />
      <ellipse cx="50" cy="107" rx="15" ry="5" fill="#e8e2d6" />
      <path d="M50 100 C28 76 34 60 50 60 C67 60 73 76 50 100" fill="#ef937c" />
      <circle cx="50" cy="75" r="6" fill="#fff6ea" />
      <circle cx="115" cy="64" r="6" fill="#c8bca5" />
      <path
        d="M196 40 C178 20 183 6 197 6 C211 6 216 20 196 40"
        fill="#789383"
      />
      <circle cx="197" cy="19" r="5" fill="#eff1e8" />
      <path
        d="M174 100 l5 -12 l5 12 l12 5 l-12 5 l-5 12 l-5 -12 l-12 -5 Z"
        fill="#e5d3b3"
      />
    </svg>
  );
}
