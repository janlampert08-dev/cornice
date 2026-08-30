import Image from "next/image";

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
      <Image
        src={url}
        alt={name ? `Profilbild von ${name}` : "Profilbild"}
        width={size}
        height={size}
        className="shrink-0 rounded-full border border-foreground/10 object-cover"
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
