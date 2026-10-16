import { Skeleton } from "./_components/ui";

export default function Cargando() {
  return (
    <div className="flex flex-col gap-8" aria-busy="true" aria-label="Cargando">
      <div className="flex max-w-2xl flex-col gap-3">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-4 w-4/5" />
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-5">
        <Skeleton className="h-64 lg:col-span-2" />
        <Skeleton className="h-64 lg:col-span-3" />
      </div>
    </div>
  );
}
