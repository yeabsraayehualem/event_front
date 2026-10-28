/**
 * An original, geometric mark in the spirit of Ethiopian hand and processional
 * crosses: four equal arms with lobed ends around a latticed centre. Drawn
 * with currentColor so it takes the text color of wherever it is placed.
 */
export function EthiopianCross({ size = 22, title }: { size?: number; title?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      className="ethiopian-cross"
    >
      {/* arms */}
      <path d="M24 9v30M9 24h30" />
      {/* lobed arm ends */}
      <circle cx="24" cy="6" r="3" />
      <circle cx="24" cy="42" r="3" />
      <circle cx="6" cy="24" r="3" />
      <circle cx="42" cy="24" r="3" />
      {/* latticed centre */}
      <rect x="17" y="17" width="14" height="14" transform="rotate(45 24 24)" />
      <path d="M19.5 19.5l9 9M28.5 19.5l-9 9" strokeWidth="1.4" />
      {/* small side buds */}
      <path d="M14 19.5l-3-3M34 19.5l3-3M14 28.5l-3 3M34 28.5l3 3" strokeWidth="1.6" />
    </svg>
  )
}

/** A woven tibeb band (the border pattern on habesha kemis and netela). */
export function TibebBand({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 240 24" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <pattern id="tibeb" width="24" height="24" patternUnits="userSpaceOnUse">
          <rect width="24" height="24" fill="#28513c" />
          <path d="M0 12 12 2l12 10-12 10Z" fill="#bd9a57" />
          <path d="M6 12l6-5 6 5-6 5Z" fill="#a6463c" />
          <path d="M11 12h2" stroke="#f8f5ec" strokeWidth="2" />
          <rect y="0" width="24" height="1.5" fill="#bd9a57" />
          <rect y="22.5" width="24" height="1.5" fill="#bd9a57" />
        </pattern>
      </defs>
      <rect width="240" height="24" fill="url(#tibeb)" />
    </svg>
  )
}
