export default function DashboardLoading() {
  return (
    <div className="space-y-8">
      {/* Page header skeleton */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-surface shimmer" />
        <div className="space-y-2">
          <div className="h-7 w-48 rounded-lg bg-surface shimmer" />
          <div className="h-4 w-72 rounded-md bg-surface shimmer" />
        </div>
      </div>

      {/* Card grid skeleton */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl border border-border bg-card p-6 space-y-4"
          >
            <div className="flex items-center justify-between">
              <div className="h-5 w-24 rounded-md bg-surface shimmer" />
              <div className="h-8 w-16 rounded-lg bg-surface shimmer" />
            </div>
            <div className="space-y-2">
              <div className="h-3 w-full rounded bg-surface shimmer" />
              <div className="h-3 w-3/4 rounded bg-surface shimmer" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
