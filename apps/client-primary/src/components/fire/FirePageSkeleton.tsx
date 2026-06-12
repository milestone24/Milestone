import { Skeleton } from "@/components/ui/skeleton";

export function FirePageSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-48" />
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
      <Skeleton className="h-48 w-full" />
      <Skeleton className="h-[520px] w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

