import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Image, Video, Filter, ArrowLeft, RefreshCw, Copy } from "lucide-react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";

export default function SearchGenerations() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [query, setQuery] = useState("");
  const [mediaType, setMediaType] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [page, setPage] = useState(0);

  const searchInput = useMemo(() => ({
    query: query || undefined,
    mediaType: mediaType as "image" | "video" | undefined || undefined,
    status: status || undefined,
    limit: 20,
    offset: page * 20,
  }), [query, mediaType, status, page]);

  const results = trpc.search.generations.useQuery(searchInput, { enabled: !!user });

  if (!user) {
    return (
      <div className="container py-20 text-center">
        <Search className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
        <h1 className="text-3xl font-bold mb-4">Search Generations</h1>
        <p className="text-muted-foreground mb-6">Search through your generation history.</p>
        <a href={getLoginUrl()}><Button size="lg">Sign In</Button></a>
      </div>
    );
  }

  return (
    <div className="container py-8 max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/workspace"><Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button></Link>
        <div>
          <h1 className="text-3xl font-bold">Generation History</h1>
          <p className="text-muted-foreground">Search and filter your past generations</p>
        </div>
      </div>

      {/* Search Bar */}
      <div className="flex gap-3 mb-6 flex-wrap">
        <div className="flex-1 min-w-[200px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search prompts..."
            value={query}
            onChange={(e) => { setQuery(e.target.value); setPage(0); }}
            className="pl-10"
          />
        </div>
        <Select value={mediaType} onValueChange={(v) => { setMediaType(v === "all" ? "" : v); setPage(0); }}>
          <SelectTrigger className="w-[130px]"><SelectValue placeholder="Media type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="image">Images</SelectItem>
            <SelectItem value="video">Videos</SelectItem>
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={(v) => { setStatus(v === "all" ? "" : v); setPage(0); }}>
          <SelectTrigger className="w-[130px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="processing">Processing</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Results Count */}
      {results.data && (
        <p className="text-sm text-muted-foreground mb-4">
          {results.data.total} result{results.data.total !== 1 ? "s" : ""} found
          {query && <> for "<strong>{query}</strong>"</>}
        </p>
      )}

      {/* Results Grid */}
      {results.isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map(i => <Skeleton key={i} className="aspect-square" />)}
        </div>
      ) : results.data?.items.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <Search className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">No Results</h3>
            <p className="text-muted-foreground">Try adjusting your search or filters.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {results.data?.items.map((gen) => (
              <Card key={gen.id} className="overflow-hidden group hover:shadow-lg transition-shadow cursor-pointer">
                <div className="aspect-square bg-muted relative">
                  {gen.imageUrl ? (
                    <img src={gen.imageUrl} alt="" className="w-full h-full object-cover" />
                  ) : gen.thumbnailUrl ? (
                    <img src={gen.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      {gen.mediaType === "video" ? <Video className="w-8 h-8 text-muted-foreground" /> : <Image className="w-8 h-8 text-muted-foreground" />}
                    </div>
                  )}
                  <div className="absolute top-2 right-2 flex gap-1">
                    <Badge variant="secondary" className="text-xs">
                      {gen.mediaType === "video" ? <Video className="w-3 h-3 mr-1" /> : <Image className="w-3 h-3 mr-1" />}
                      {gen.mediaType}
                    </Badge>
                  </div>
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
                    <div className="space-y-2 w-full">
                      <p className="text-white text-xs line-clamp-3">{gen.prompt}</p>
                      <div className="flex gap-1">
                        <Button size="sm" variant="secondary" className="text-xs h-7" onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(gen.prompt); toast.success("Prompt copied"); }}>
                          <Copy className="w-3 h-3 mr-1" /> Copy
                        </Button>
                        <Button size="sm" variant="secondary" className="text-xs h-7" onClick={(e) => { e.stopPropagation(); navigate(`/workspace?prompt=${encodeURIComponent(gen.prompt)}`); }}>
                          <RefreshCw className="w-3 h-3 mr-1" /> Reuse
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
                <CardContent className="p-2">
                  <p className="text-xs text-muted-foreground truncate">{gen.prompt}</p>
                  <p className="text-xs text-muted-foreground">{new Date(gen.createdAt).toLocaleDateString()}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Pagination */}
          {results.data && results.data.total > 20 && (
            <div className="flex justify-center gap-2 mt-6">
              <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}>
                Previous
              </Button>
              <span className="text-sm text-muted-foreground self-center">
                Page {page + 1} of {Math.ceil(results.data.total / 20)}
              </span>
              <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={(page + 1) * 20 >= results.data.total}>
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
