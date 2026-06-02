export default function DashboardLoading() {
  return (
    <div className="space-y-10 animate-content-enter">
      {/* Accent line skeleton */}
      <div>
        <div className="mb-4 h-[3px] w-12 rounded shimmer" />
        <div className="flex items-center gap-4">
          <div className="h-11 w-11 rounded-2xl shimmer" />
          <div className="space-y-2">
            <div className="h-7 w-52 rounded-lg shimmer" />
            <div className="h-4 w-72 rounded-md shimmer" />
          </div>
        </div>
      </div>

      {/* Chat skeleton */}
      <div className="glass-card rounded-2xl p-6">
        <div className="mb-4 flex items-center gap-2">
          <div className="h-3.5 w-3.5 rounded shimmer" />
          <div className="h-3 w-36 rounded shimmer" />
        </div>
        <div className="flex flex-col items-center py-8">
          <div className="mb-3 h-12 w-12 rounded-2xl shimmer" />
          <div className="h-4 w-64 rounded shimmer" />
        </div>
        <div className="flex gap-2">
          <div className="h-11 flex-1 rounded-xl shimmer" />
          <div className="h-11 w-11 rounded-xl shimmer" />
        </div>
      </div>

      {/* Stats skeleton */}
      <div>
        <div className="mb-4 flex items-center gap-2">
          <div className="h-3.5 w-3.5 rounded shimmer" />
          <div className="h-3 w-28 rounded shimmer" />
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="rounded-2xl border border-border bg-card p-4"
              style={{ animationDelay: `${i * 100}ms` }}
            >
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl shimmer" />
                <div className="space-y-1.5">
                  <div className="h-5 w-8 rounded shimmer" />
                  <div className="h-2.5 w-14 rounded shimmer" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Activity skeleton */}
      <div className="glass-card rounded-2xl p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-3.5 w-3.5 rounded shimmer" />
            <div className="h-3 w-32 rounded shimmer" />
          </div>
          <div className="h-4 w-4 rounded shimmer" />
        </div>
      </div>
    </div>
  );
}
