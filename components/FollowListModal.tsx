"use client";

import Link from "next/link";
import Avatar from "@/components/Avatar";
import { Dialog } from "@/components/ui/Dialog";
import EmptyState from "@/components/ui/EmptyState";
import { Users } from "lucide-react";
import type { FollowProfile } from "@/lib/follows";

// Popup für die Follower/Following-Zahlen auf Profilseiten (eigenes und
// fremde öffentliche) — Dialog.tsx gibt Fokus-Trap, Escape und
// Klick-ausserhalb-schliesst bereits kostenlos (natives <dialog>).
export default function FollowListModal({
  open,
  onClose,
  title,
  profiles,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  profiles: FollowProfile[];
}) {
  return (
    <Dialog open={open} onClose={onClose} title={title} className="max-h-[70vh] overflow-y-auto">
      {profiles.length === 0 ? (
        <EmptyState icon={Users} title="Noch niemand." />
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {profiles.map((profile) => (
            <li key={profile.id}>
              <Link
                href={`/fahrer/${profile.id}`}
                onClick={onClose}
                className="flex items-center gap-3 py-2.5 transition-colors duration-fast hover:text-accent"
              >
                <Avatar url={profile.avatarUrl} name={profile.displayName} size={36} />
                <span className="truncate text-sm font-medium">
                  {profile.displayName ?? "Fahrer"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Dialog>
  );
}
