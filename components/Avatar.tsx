export default function Avatar({
  url,
  name,
  size = 48,
}: {
  url: string | null;
  name: string | null;
  size?: number;
}) {
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={name ? `Profilbild von ${name}` : "Profilbild"}
        className="shrink-0 rounded-full border border-foreground/10 object-cover"
        style={{ width: size, height: size }}
      />
    );
  }

  const initial = (name ?? "?").trim().charAt(0).toUpperCase() || "?";
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full border border-foreground/10 bg-foreground/5 font-medium text-muted"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
      aria-hidden="true"
    >
      {initial}
    </div>
  );
}
