/**
 * Hadafe Nefs mark: a reed tankwa carrying the Orthodox wedding crown
 * (gold arches over red velvet, jeweled band, cross on top).
 * Colors are props so the mark works on light and dark backgrounds.
 */
type MarkColors = { velvet?: string; gold?: string; cream?: string; cross?: string; water?: string }

export function HadafeMark({
  size = 40,
  velvet = '#8C2F2B',
  gold = '#B8914A',
  cream = '#F6F0E2',
  cross = velvet,
  water = velvet,
  title,
}: MarkColors & { size?: number; title?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      className="hadafe-mark"
    >
      <path d="M42.5 61C36 52 45 37.5 60 37.5S84 52 77.5 61Z" fill={velvet} />
      <g fill="none" stroke={gold} strokeWidth="2.6" strokeLinecap="round">
        <path d="M60 38V61" />
        <path d="M45.5 60.5C40 50 49 40 60 38" />
        <path d="M74.5 60.5C80 50 71 40 60 38" />
      </g>
      <g fill={cream}>
        <circle cx="60" cy="45" r="1.2" />
        <circle cx="60" cy="52" r="1.2" />
        <circle cx="46.6" cy="46" r="1.1" />
        <circle cx="73.4" cy="46" r="1.1" />
      </g>
      <g fill={gold}>
        <circle cx="41" cy="60" r="2.2" />
        <circle cx="50.5" cy="60" r="2.2" />
        <circle cx="60" cy="60" r="2.2" />
        <circle cx="69.5" cy="60" r="2.2" />
        <circle cx="79" cy="60" r="2.2" />
      </g>
      <rect x="38.5" y="60.5" width="43" height="9" rx="2" fill={gold} />
      <g fill={velvet}>
        <ellipse cx="45" cy="65" rx="2.4" ry="2.8" />
        <ellipse cx="60" cy="65" rx="2.6" ry="3" />
        <ellipse cx="75" cy="65" rx="2.4" ry="2.8" />
      </g>
      <g fill={cream}>
        <circle cx="52.5" cy="65" r="1.3" />
        <circle cx="67.5" cy="65" r="1.3" />
      </g>
      <circle cx="60" cy="34.5" r="3.2" fill={gold} />
      <g fill="none" stroke={cross} strokeLinecap="round" strokeLinejoin="round">
        <path d="M60 31V12" strokeWidth="3.2" />
        <path d="M51 20h18" strokeWidth="3.2" />
        <circle cx="60" cy="8" r="3.4" strokeWidth="2.4" />
        <circle cx="47.5" cy="20" r="3.4" strokeWidth="2.4" />
        <circle cx="72.5" cy="20" r="3.4" strokeWidth="2.4" />
      </g>
      <path d="M6 62C16 94 104 94 114 62C100 75 80 78 60 78S20 75 6 62Z" fill={gold} />
      <g stroke={cream} strokeWidth="2" strokeLinecap="round">
        <path d="M26 76l-1 6M43 78.6v6.4M60 79.2v7M77 78.6v6.4M94 76l1 6" />
      </g>
      <g fill="none" stroke={water} strokeWidth="2.6" strokeLinecap="round">
        <path d="M20 100c7-4 13-4 20 0s13 4 20 0 13-4 20 0 13 4 20 0" />
        <path d="M34 109c6-3 13-3 19 0s13 3 19 0 13-3 19 0" />
      </g>
    </svg>
  )
}

/** Mark + Amharic name + Latin name. `onDark` switches to cream/light-gold colors. */
export function HadafeLockup({ size = 44, onDark = false }: { size?: number; onDark?: boolean }) {
  const c = onDark
    ? { velvet: '#5E1B18', gold: '#C9A45C', cream: '#F6F0E2', cross: '#F6F0E2', water: '#F6F0E2' }
    : {}
  return (
    <span className="hadafe-lockup">
      <HadafeMark size={size} {...c} />
      <span className="hadafe-lockup-text">
        <strong lang="am">ኀዳፌ ነፍስ</strong>
        <em>HADAFE NEFS</em>
      </span>
    </span>
  )
}
