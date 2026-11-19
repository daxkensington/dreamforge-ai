import { useEffect, useRef, useState } from "react";
import { Download, Play, Scissors } from "lucide-react";
import ToolPageLayout from "@/components/ToolPageLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  exportTimeline,
  inspectTimelineFile,
  MIN_UNPADDED_EXPORT_SECONDS,
  validateClipRecording,
  VIDEO_SOURCE_MAX_BYTES,
} from "@/components/timeline/timelineMedia";
import { emptyTimeline } from "@shared/timeline";

const MIN_CLIP_SECONDS = MIN_UNPADDED_EXPORT_SECONDS;
const MAX_CLIP_SECONDS = 60;

type Frame = "landscape" | "portrait" | "square";
type Source = { url: string; file: File; duration: number };
type Result = { url: string; extension: string };

export default function ClipMaker() {
  const [source, setSource] = useState<Source | null>(null);
  const [start, setStart] = useState("0");
  const [end, setEnd] = useState("");
  const [frame, setFrame] = useState<Frame>("landscape");
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<{
    fraction: number;
    label: string;
  } | null>(null);
  const preview = useRef<HTMLVideoElement>(null);
  const previewEnd = useRef<number | null>(null);
  const selection = useRef(0);
  const exporting = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      if (source) URL.revokeObjectURL(source.url);
    };
  }, [source]);
  useEffect(() => {
    return () => {
      if (result) URL.revokeObjectURL(result.url);
    };
  }, [result]);
  useEffect(
    () => () => {
      selection.current++;
      exporting.current?.abort();
      exporting.current = null;
    },
    []
  );

  const from = Number(start);
  const to = Number(end);
  const duration = to - from;
  const validRange =
    !!source &&
    start.trim() !== "" &&
    end.trim() !== "" &&
    Number.isFinite(from) &&
    Number.isFinite(to) &&
    from >= 0 &&
    to <= source.duration &&
    duration >= MIN_CLIP_SECONDS - 1e-9 &&
    duration <= MAX_CLIP_SECONDS + 1e-9;

  async function chooseVideo(file: File) {
    if (exporting.current) return;
    const request = ++selection.current;
    previewEnd.current = null;
    setSource(null);
    setResult(null);
    setError("");
    setLoading(true);
    try {
      if (file.size === 0 || file.size > VIDEO_SOURCE_MAX_BYTES) {
        throw new Error("Choose a non-empty video up to 25 MiB.");
      }
      const media = await inspectTimelineFile(file);
      if (selection.current !== request) return;
      if (media.kind !== "video") throw new Error("Choose a video file.");
      if (media.duration < MIN_CLIP_SECONDS) {
        throw new Error("Choose a video at least 1 second long.");
      }
      setSource({
        url: URL.createObjectURL(file),
        file,
        duration: media.duration,
      });
      setStart("0");
      setEnd(String(Math.min(media.duration, MAX_CLIP_SECONDS)));
    } catch (cause) {
      if (selection.current === request) {
        setError(
          cause instanceof Error ? cause.message : "Could not open the video."
        );
      }
    } finally {
      if (selection.current === request) setLoading(false);
    }
  }

  function playRange() {
    const video = preview.current;
    if (!video || !validRange) return;
    setError("");
    previewEnd.current = to;
    video.currentTime = from;
    void video.play().catch(() => {
      if (preview.current !== video) return;
      previewEnd.current = null;
      setError("This browser could not play the selected range.");
    });
  }

  async function exportClip() {
    if (!source || !validRange || exporting.current) return;
    const controller = new AbortController();
    exporting.current = controller;
    preview.current?.pause();
    previewEnd.current = null;
    setResult(null);
    setError("");
    setProgress({ fraction: 0, label: "Preparing video" });
    const timeline = emptyTimeline();
    const clipId = "clip-maker";
    timeline.clips.push({
      id: clipId,
      trackId: timeline.tracks[0].id,
      type: "video",
      mediaKind: "video",
      startTime: 0,
      trimStart: from,
      duration: Math.max(MIN_CLIP_SECONDS, duration),
      sourceDuration: source.duration,
      name: source.file.name,
    });
    try {
      const output = await exportTimeline(timeline, {
        signal: controller.signal,
        frame,
        localSources: new Map([[clipId, source.file]]),
        onProgress: (fraction, label) => {
          if (exporting.current === controller)
            setProgress({ fraction, label });
        },
      });
      if (controller.signal.aborted) return;
      setProgress({ fraction: 1, label: "Checking the exported clip" });
      await validateClipRecording(output.blob, duration, controller.signal);
      if (exporting.current === controller && !controller.signal.aborted) {
        setResult({
          url: URL.createObjectURL(output.blob),
          extension: output.extension,
        });
      }
    } catch (cause) {
      if (exporting.current === controller && !controller.signal.aborted) {
        setError(
          cause instanceof Error ? cause.message : "Could not export the clip."
        );
      }
    } finally {
      if (exporting.current === controller) {
        exporting.current = null;
        setProgress(null);
      }
    }
  }

  return (
    <ToolPageLayout
      title="Clip Maker"
      description="Trim a video and download the selected range with its original audio. The file stays in this browser."
      icon={Scissors}
      gradient="from-cyan-500 to-blue-600"
      costCredits={0}
      requiresSignIn={false}
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="min-w-0 space-y-4" aria-labelledby="clip-source">
          <h2 id="clip-source" className="text-xl font-semibold">
            Source video
          </h2>
          <label htmlFor="clip-file" className="block text-sm font-medium">
            Choose a video
          </label>
          <Input
            id="clip-file"
            type="file"
            accept="video/*"
            disabled={progress !== null}
            onChange={event => {
              const file = event.currentTarget.files?.[0];
              event.currentTarget.value = "";
              if (file) void chooseVideo(file);
            }}
          />
          <p className="text-sm text-muted-foreground">
            Choose a browser-readable video up to 25 MiB.
          </p>
          {loading && <p role="status">Opening video…</p>}
          {source && (
            <>
              <video
                ref={preview}
                src={source.url}
                controls
                playsInline
                aria-label="Source video preview"
                className="max-h-[28rem] w-full rounded-lg bg-black"
                onTimeUpdate={event => {
                  const video = event.currentTarget;
                  if (
                    !video.seeking &&
                    previewEnd.current !== null &&
                    video.currentTime >= previewEnd.current
                  ) {
                    video.pause();
                    previewEnd.current = null;
                  }
                }}
                onEnded={() => {
                  previewEnd.current = null;
                }}
              />
              <p className="break-all text-sm text-muted-foreground">
                {source.file.name} · {source.duration.toFixed(2)} seconds
              </p>
            </>
          )}
        </section>

        <section className="min-w-0 space-y-4" aria-labelledby="clip-settings">
          <h2 id="clip-settings" className="text-xl font-semibold">
            Trim and export
          </h2>
          <fieldset
            className="space-y-4"
            disabled={!source || progress !== null}
          >
            <div className="grid grid-cols-2 gap-3">
              <label className="space-y-2 text-sm">
                <span>Start (seconds)</span>
                <Input
                  type="number"
                  min={0}
                  max={source?.duration}
                  step="any"
                  value={start}
                  onChange={event => {
                    setStart(event.target.value);
                    setResult(null);
                  }}
                />
              </label>
              <label className="space-y-2 text-sm">
                <span>End (seconds)</span>
                <Input
                  type="number"
                  min={0}
                  max={source?.duration}
                  step="any"
                  value={end}
                  onChange={event => {
                    setEnd(event.target.value);
                    setResult(null);
                  }}
                />
              </label>
            </div>
            <label className="block space-y-2 text-sm">
              <span>Output format</span>
              <select
                className="block w-full rounded-md border border-input bg-background px-3 py-2"
                value={frame}
                onChange={event => {
                  setFrame(event.target.value as Frame);
                  setResult(null);
                }}
              >
                <option value="landscape">Landscape (16:9)</option>
                <option value="portrait">Portrait (9:16)</option>
                <option value="square">Square (1:1)</option>
              </select>
            </label>
          </fieldset>
          <p className="text-sm text-muted-foreground">
            {validRange
              ? `${duration.toFixed(2)}-second clip.`
              : `Choose a range from ${MIN_CLIP_SECONDS} to ${MAX_CLIP_SECONDS} seconds within the source.`}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              disabled={!validRange || !!progress}
              onClick={playRange}
            >
              <Play size={16} aria-hidden="true" /> Preview selection
            </Button>
            <Button
              disabled={!validRange || !!progress}
              onClick={() => void exportClip()}
            >
              <Scissors size={16} aria-hidden="true" /> Export clip
            </Button>
            {progress && (
              <Button
                variant="outline"
                onClick={() => exporting.current?.abort()}
              >
                Cancel export
              </Button>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            Keep this tab visible during export. The browser chooses WebM or
            MP4.
          </p>
          {progress && (
            <div className="space-y-2">
              <p role="status">{progress.label}</p>
              <progress
                className="w-full"
                max={1}
                value={progress.fraction}
                aria-label="Export progress"
              />
            </div>
          )}
          {error && (
            <p role="alert" className="text-sm text-red-400">
              {error}
            </p>
          )}
          {result && (
            <Button asChild>
              <a
                href={result.url}
                download={`dreamforgex-clip.${result.extension}`}
              >
                <Download size={16} aria-hidden="true" /> Download clip
              </a>
            </Button>
          )}
        </section>
      </div>
    </ToolPageLayout>
  );
}
