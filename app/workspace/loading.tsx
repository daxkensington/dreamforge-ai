export default function Loading() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container py-8">
        <div className="h-10 w-48 bg-white/5 rounded-lg animate-pulse mb-6" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="h-40 bg-white/5 rounded-xl animate-pulse" />
            <div className="h-12 bg-white/5 rounded-lg animate-pulse" />
          </div>
          <div className="space-y-4">
            <div className="h-64 bg-white/5 rounded-xl animate-pulse" />
            <div className="h-32 bg-white/5 rounded-xl animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );
}
