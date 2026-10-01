/** Skeleton shown while the license data is being read. */
export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="h-9 w-72 animate-pulse rounded-xl bg-slate-200/70" />
      <div className="h-24 animate-pulse rounded-2xl bg-slate-200/70" />
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="h-72 animate-pulse rounded-2xl bg-slate-200/70" />
        <div className="h-72 animate-pulse rounded-2xl bg-slate-200/70" />
      </div>
    </div>
  );
}
