import Avatar from "@/components/Avatar";
import type { FollowProfile } from "@/lib/follows";

// Dezenter Hinweis auf einem fremden Profil, analog Instagrams "Followed by
// X, Y and Z others": welche der Personen, denen der Betrachter selbst
// folgt, ihrerseits diesem Profil folgen. Bewusst klein/muted gehalten und
// ohne Links auf die einzelnen Profile — es ist ein Kontext-Hinweis, keine
// weitere Liste neben FollowListModal.
function formatText(names: string[], totalCount: number): string {
  if (totalCount <= 3) {
    if (names.length <= 1) return `Gefolgt von ${names[0]}`;
    if (names.length === 2) return `Gefolgt von ${names[0]} und ${names[1]}`;
    return `Gefolgt von ${names[0]}, ${names[1]} und ${names[2]}`;
  }
  const remaining = totalCount - 2;
  return `Gefolgt von ${names[0]}, ${names[1]} und ${remaining} weiteren`;
}

export default function FollowedBy({
  preview,
  totalCount,
}: {
  preview: FollowProfile[];
  totalCount: number;
}) {
  if (totalCount === 0 || preview.length === 0) return null;

  const names = preview.map((p) => p.displayName ?? "Fahrer");

  return (
    <div className="flex items-center gap-1.5 text-xs text-muted">
      <div className="flex -space-x-1.5">
        {preview.slice(0, 3).map((p) => (
          <div key={p.id} className="rounded-full ring-2 ring-background">
            <Avatar url={p.avatarUrl} name={p.displayName} size={18} />
          </div>
        ))}
      </div>
      <span>{formatText(names, totalCount)}</span>
    </div>
  );
}
