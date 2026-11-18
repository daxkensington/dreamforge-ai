import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Film } from "lucide-react";
import PageLayout from "@/components/PageLayout";
import { Button } from "@/components/ui/button";

export default function MusicVideoStudio() {
  const [song, setSong] = useState<{ url: string; title: string } | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    try {
      const url = new URL(params.get("song") ?? "");
      if ((url.protocol === "https:" || url.protocol === "http:") && !url.username && !url.password) {
        setSong({ url: url.href, title: params.get("title")?.slice(0, 200) || "Your song" });
      }
    } catch {
      // Direct visits do not need a song URL.
    }
  }, []);

  return (
    <PageLayout>
      <div className="container max-w-4xl py-10 md:py-14">
        <div className="inline-flex items-center gap-2 rounded-full border border-purple-500/20 bg-purple-500/10 px-3 py-1 text-xs text-purple-400">
          <Film className="h-3 w-3" /> Music Video Studio
        </div>
        <h1 className="mt-4 text-3xl font-bold tracking-tight md:text-4xl">Make a music video</h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          Create a video clip in the workspace, then add your audio and export it in the timeline editor.
        </p>
        <div role="status" className="mt-6 rounded-lg border border-cyan-500/30 bg-cyan-500/10 p-4 text-sm">
          Automatic music video generation is temporarily unavailable. Use the steps below to make a music video manually.
        </div>

        {song && (
          <section className="mt-8 rounded-xl border border-border/50 p-5" aria-label="Your song">
            <h2 className="font-semibold">{song.title}</h2>
            <audio src={song.url} controls className="mt-3 w-full" />
            <p className="mt-3 text-sm text-muted-foreground">Save this audio to your device, then upload it in the timeline editor.</p>
            <Button asChild variant="outline" className="mt-3"><a href={song.url} download>Open or download song</a></Button>
          </section>
        )}

        <ol className="mt-8 space-y-5">
          <li className="rounded-xl border border-border/50 p-5">
            <h2 className="font-semibold">1. Generate a video clip</h2>
            <p className="mt-2 text-sm text-muted-foreground">Choose Video in the workspace, select an available model, and review its credit price before generating.</p>
            <Button asChild className="mt-4"><Link href="/workspace">Open workspace</Link></Button>
          </li>
          <li className="rounded-xl border border-border/50 p-5">
            <h2 className="font-semibold">2. Add your audio and export</h2>
            <p className="mt-2 text-sm text-muted-foreground">Import the completed video into the timeline, upload your audio file, arrange the tracks, and export from your browser.</p>
            <Button asChild variant="outline" className="mt-4"><Link href="/timeline/new">Open timeline editor</Link></Button>
          </li>
        </ol>
      </div>
    </PageLayout>
  );
}
