// Gleicher Stil wie VisibilityIcons.tsx (viewBox 0 0 20 20, strokeWidth 1.4) —
// eigene Datei, da diese Icons für die Bottom-Nav gedacht sind, nicht für
// Sichtbarkeits-Umschalter.

export function MapPinIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      className={className}
      aria-hidden="true"
    >
      <path d="M10 2.5c-3 0-5.5 2.4-5.5 5.5 0 4 5.5 9.5 5.5 9.5s5.5-5.5 5.5-9.5c0-3.1-2.5-5.5-5.5-5.5Z" />
      <circle cx="10" cy="8" r="2" />
    </svg>
  );
}

export function RankingIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      className={className}
      aria-hidden="true"
    >
      <rect x="3" y="11" width="4" height="6" />
      <rect x="8" y="7" width="4" height="10" />
      <rect x="13" y="3" width="4" height="14" />
    </svg>
  );
}

export function PersonIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      className={className}
      aria-hidden="true"
    >
      <circle cx="10" cy="6.5" r="3.5" />
      <path d="M3.5 17c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6" />
    </svg>
  );
}

export function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      className={className}
      aria-hidden="true"
    >
      <path d="M10 2.5l6.5 2.5v5c0 4.5-3 7.5-6.5 8.5-3.5-1-6.5-4-6.5-8.5v-5L10 2.5Z" />
      <path d="M7.2 10l2 2 3.6-4" />
    </svg>
  );
}
