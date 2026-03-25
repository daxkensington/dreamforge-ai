export default function Loading() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container py-8">
        <div className="h-10 w-48 bg-white/5 rounded-lg animate-pulse mb-8" />
        <div className="h-32 bg-white/5 rounded-xl animate-pulse mb-6" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-48 bg-white/5 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  );
}
