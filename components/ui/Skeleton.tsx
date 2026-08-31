import { cn } from "@/lib/utils/cn";

// Ein Baustein für alle Ladezustände (bisher nur ad hoc in app/loading.tsx).
// Bewusst ohne Default-Radius — Form/Größe kommt vollständig über className
// (h-4 w-24 rounded-md, aspect-video, rounded-full, randlose Flächen ohne
// jede rounded-*-Klasse …).
export default function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse bg-foreground/10", className)} />;
}
