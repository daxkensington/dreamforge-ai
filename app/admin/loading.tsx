export default function Loading() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container py-8">
        <span role="status" className="sr-only">Loading admin dashboard</span>
        <div className="h-10 w-48 bg-white/5 rounded-lg animate-pulse mb-8" aria-hidden="true" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8" aria-hidden="true">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 bg-white/5 rounded-xl animate-pulse" aria-hidden="true" />
          ))}
        </div>
        <div className="h-64 bg-white/5 rounded-xl animate-pulse" aria-hidden="true" />
      </div>
    </div>
  );
}
