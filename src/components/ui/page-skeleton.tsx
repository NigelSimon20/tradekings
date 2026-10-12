/**
 * The grey placeholder shown while a tracker's data is read. `tiles` adds a
 * row of dashboard tiles (the contract dashboard opens with eight).
 */
export function PageSkeleton({ tiles = 0 }: { tiles?: number }) {
  const block = "animate-pulse rounded-2xl bg-slate-200/70";
  return (
    <div className="space-y-6">
      <div className="h-9 w-72 animate-pulse rounded-xl bg-slate-200/70" />
      <div className={`h-24 ${block}`} />
      {tiles ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: tiles }, (_, index) => (
            <div key={index} className={`h-32 ${block}`} />
          ))}
        </div>
      ) : null}
      <div className="grid gap-5 lg:grid-cols-2">
        <div className={`h-72 ${block}`} />
        <div className={`h-72 ${block}`} />
      </div>
    </div>
  );
}
