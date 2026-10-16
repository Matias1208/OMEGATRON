import { Skeleton } from "./_components/ui";

export default function Cargando() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Cargando">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-12">
        <Skeleton className="h-64 lg:col-span-7" />
        <Skeleton className="h-64 lg:col-span-5" />
      </div>
      <div className="grid gap-4 lg:grid-cols-12">
        <Skeleton className="h-72 lg:col-span-8" />
        <Skeleton className="h-72 lg:col-span-4" />
      </div>
    </div>
  );
}
