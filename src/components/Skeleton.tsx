export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-3 h-9 animate-pulse rounded bg-gray-100" />
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="h-10 animate-pulse rounded bg-gray-100" />
        ))}
      </div>
    </div>
  );
}
