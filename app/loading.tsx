import Skeleton from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="flex h-dvh flex-col">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-6 sm:py-4">
        <Skeleton className="h-5 w-20 rounded-md" />
        <Skeleton className="h-5 w-16 rounded-md" />
      </div>
      <div className="flex flex-1 flex-col overflow-hidden md:flex-row">
        <Skeleton className="h-64 shrink-0 md:order-2 md:h-auto md:flex-1" />
        <div className="flex w-full flex-col gap-3 px-5 py-5 sm:px-6 sm:py-6 md:max-w-sm">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
}
