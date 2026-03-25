export default function Loading() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container py-16 text-center">
        <div className="h-12 w-80 bg-white/5 rounded-lg animate-pulse mx-auto mb-4" />
        <div className="h-6 w-96 bg-white/5 rounded-lg animate-pulse mx-auto mb-10" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-12">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 bg-white/5 rounded-xl animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="space-y-3">
              <div className="aspect-video bg-white/5 rounded-xl animate-pulse" />
              <div className="h-4 w-3/4 bg-white/5 rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
