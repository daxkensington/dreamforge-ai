export default function Loading() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container py-8">
        <div className="h-12 w-full max-w-xl bg-muted rounded-xl animate-pulse mb-6" />
        <div className="flex gap-2 mb-6">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-8 w-20 bg-muted rounded-full animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="aspect-square bg-muted rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  );
}
