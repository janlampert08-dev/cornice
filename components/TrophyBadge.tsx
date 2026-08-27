export default function TrophyBadge({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`inline shrink-0 text-[#C9A227] ${className}`}
      aria-label="Premium"
    >
      <title>Premium</title>
      <path d="M6.5 4h7v3.2a3.5 3.5 0 0 1-7 0V4Z" />
      <path d="M6.5 5H4.3a1.8 1.8 0 0 0 1.8 1.8" />
      <path d="M13.5 5h2.2a1.8 1.8 0 0 1-1.8 1.8" />
      <path d="M10 10.7v2.3" />
      <path d="M7.8 16h4.4" />
      <path d="M8.7 13h2.6l.5 3H8.2l.5-3Z" />
    </svg>
  );
}
