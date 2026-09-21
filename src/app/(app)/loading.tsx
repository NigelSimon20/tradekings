/** Skeleton shown while the contract database is being read. */
export default function Loading() {
  return (
    <div className="space-y-7">
      <div className="h-9 w-72 animate-pulse rounded-xl bg-slate-200/70" />
      <div className="h-28 animate-pulse rounded-2xl bg-slate-200/70" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }, (_, index) => (
          <div key={index} className="h-32 animate-pulse rounded-2xl bg-slate-200/70" />
        ))}
      </div>
      <div className="h-80 animate-pulse rounded-2xl bg-slate-200/70" />
    </div>
  );
}
