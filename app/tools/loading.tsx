export default function Loading() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container py-16 text-center">
        <div className="h-12 w-64 bg-white/5 rounded-lg animate-pulse mx-auto mb-4" />
        <div className="h-6 w-96 bg-white/5 rounded-lg animate-pulse mx-auto mb-12" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="aspect-[4/3] bg-white/5 rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  );
}
