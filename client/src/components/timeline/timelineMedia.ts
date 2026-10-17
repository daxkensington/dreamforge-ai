import { activeClips, selectRecordingFormat, timelineDuration, type Clip, type TimelineDocument } from "@shared/timeline";

type Asset = { element: HTMLImageElement | HTMLMediaElement; url: string; gain?: GainNode; source?: MediaElementAudioSourceNode };
const abortError = () => new DOMException("Operation cancelled", "AbortError");
function eventReady(element: HTMLMediaElement, event: string, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(() => done(new Error("Media loading timed out")), 30000);
    const ready = () => done(); const error = () => done(new Error("This browser cannot decode the media file"));
    const abort = () => done(abortError());
    function done(err?: Error) { clearTimeout(timeout); element.removeEventListener(event, ready); element.removeEventListener("error", error); signal?.removeEventListener("abort", abort); err ? reject(err) : resolve(); }
    element.addEventListener(event, ready, { once: true }); element.addEventListener("error", error, { once: true });
    signal?.addEventListener("abort", abort, { once: true }); if (signal?.aborted) abort();
  });
}
async function finiteDuration(element: HTMLMediaElement, signal?: AbortSignal) {
  // Browser-recorded WebM often omits its duration header. Seeking to the end
  // lets the decoder determine the length of this already bounded local Blob.
  if (!Number.isFinite(element.duration)) {
    const sought = eventReady(element, "seeked", signal); element.currentTime = 1e10; await sought;
  }
  if (!Number.isFinite(element.duration) || element.duration < .1) throw new Error("Media has no finite duration");
  const duration = element.duration;
  if (element.currentTime > 0) { const reset = eventReady(element, "seeked", signal); element.currentTime = 0; await reset; }
  return duration;
}
export async function inspectTimelineFile(file: File): Promise<{ kind: "image" | "video" | "audio"; duration: number }> {
  const kind = file.type.startsWith("image/") ? "image" : file.type.startsWith("audio/") ? "audio" : file.type.startsWith("video/") ? "video" : null;
  if (!kind) throw new Error("Choose an image, video or audio file");
  const maxBytes = (kind === "image" ? 10 : kind === "audio" ? 20 : 25) * 1024 * 1024;
  if (file.size > maxBytes) throw new Error(`File exceeds the ${maxBytes / 1024 / 1024} MiB ${kind} limit`);
  const url = URL.createObjectURL(file);
  try {
    if (kind === "image") { const image = new Image(); image.src = url; await image.decode(); return { kind, duration: 5 }; }
    const element = document.createElement(kind === "audio" ? "audio" : "video");
    element.preload = "auto"; const ready = eventReady(element, "loadedmetadata"); element.src = url; element.load();
    try { await ready; return { kind, duration: await finiteDuration(element) }; }
    finally { element.pause(); element.removeAttribute("src"); element.load(); }
  } finally { URL.revokeObjectURL(url); }
}

export async function createTimelineRenderer(doc: TimelineDocument, canvas: HTMLCanvasElement, options: {
  signal: AbortSignal; onLoad?: (fraction: number) => void; audioContext?: AudioContext; destination?: AudioNode;
}) {
  const context = canvas.getContext("2d"); if (!context) throw new Error("Canvas rendering is unavailable");
  const assets = new Map<string, Asset>(); let totalBytes = 0; let disposed = false; let playbackError: Error | null = null;
  const cleanup = () => {
    if (disposed) return; disposed = true;
    for (const asset of assets.values()) {
      if (asset.element instanceof HTMLMediaElement) { asset.element.pause(); asset.element.removeAttribute("src"); asset.element.load(); }
      asset.source?.disconnect(); asset.gain?.disconnect(); URL.revokeObjectURL(asset.url);
    }
    assets.clear(); options.signal.removeEventListener("abort", cleanup);
  };
  options.signal.addEventListener("abort", cleanup, { once: true });
  try {
    const media = doc.clips.filter(clip => clip.sourceUrl && clip.type !== "text");
    for (const [i, clip] of media.entries()) {
      if (options.signal.aborted) throw abortError();
      let response: Response;
      const mediaSignal = AbortSignal.any([options.signal, AbortSignal.timeout(30000)]);
      try { response = await fetch(clip.sourceUrl!, { signal: mediaSignal, credentials: "same-origin" }); }
      catch (error) { if (options.signal.aborted) throw error; throw new Error(`Cannot load “${clip.name ?? clip.type}”. The source must allow CORS and still be available.`); }
      if (!response.ok) throw new Error(`Cannot load “${clip.name ?? clip.type}” (HTTP ${response.status}). Check media access or re-upload it.`);
      const reader = response.body?.getReader(); if (!reader) throw new Error("Media streaming is unavailable");
      const chunks: Uint8Array<ArrayBuffer>[] = []; let bytes = 0;
      try {
        while (true) { const part = await reader.read(); if (part.done) break;
          bytes += part.value.byteLength; totalBytes += part.value.byteLength;
          if (bytes > 25 * 1024 * 1024 || totalBytes > 256 * 1024 * 1024) { await reader.cancel(); throw new Error("Media exceeds the 25 MiB per clip / 256 MiB project rendering limit"); }
          chunks.push(part.value as Uint8Array<ArrayBuffer>);
        }
      } finally { reader.releaseLock(); }
      const url = URL.createObjectURL(new Blob(chunks, { type: response.headers.get("content-type") ?? "application/octet-stream" }));
      const kind = clip.mediaKind ?? "video";
      if (kind === "image") {
        const image = new Image(); assets.set(clip.id, { element: image, url }); image.src = url; await image.decode();
      } else {
        const element = document.createElement(kind === "audio" ? "audio" : "video");
        if (element instanceof HTMLVideoElement) element.playsInline = true;
        element.preload = "auto"; assets.set(clip.id, { element, url });
        const ready = eventReady(element, "canplay", options.signal); element.src = url; element.load(); await ready;
        const duration = await finiteDuration(element, options.signal);
        if ((clip.trimStart ?? 0) + clip.duration > duration + .1) throw new Error(`“${clip.name ?? clip.type}” is shorter than its timeline trim`);
        if ((clip.trimStart ?? 0) > 0) { const sought = eventReady(element, "seeked", options.signal); element.currentTime = clip.trimStart!; await sought; }
        if (options.audioContext && options.destination) {
          const source = options.audioContext.createMediaElementSource(element), gain = options.audioContext.createGain();
          source.connect(gain); gain.connect(options.destination); Object.assign(assets.get(clip.id)!, { source, gain });
        }
      }
      options.onLoad?.((i + 1) / Math.max(1, media.length));
    }
  } catch (error) { cleanup(); throw error; }
  const draw = (document: TimelineDocument, time: number, playing: boolean) => {
    if (playbackError) throw playbackError;
    if (disposed) return;
    context.fillStyle = "#000000"; context.fillRect(0, 0, canvas.width, canvas.height);
    const active = activeClips(document, time), activeIds = new Set(active.map(({ clip }) => clip.id));
    for (const [clipId, asset] of assets) if (asset.element instanceof HTMLMediaElement && !activeIds.has(clipId)) asset.element.pause();
    for (const { clip, sourceTime, volume } of active) {
      const asset = assets.get(clip.id);
      if (asset?.element instanceof HTMLMediaElement) {
        const element = asset.element;
        if (Math.abs(element.currentTime - sourceTime) > (playing ? .2 : .01)) element.currentTime = sourceTime;
        if (asset.gain) asset.gain.gain.value = volume; else element.volume = volume;
        if (playing && element.paused) void element.play().catch(() => { playbackError = new Error("Media playback was blocked or decoding failed. Pause, reload the media, and press Play again."); });
        if (!playing) element.pause();
      }
      if (clip.type === "video" && asset) {
        const element = asset.element;
        const width = element instanceof HTMLVideoElement ? element.videoWidth : element instanceof HTMLImageElement ? element.naturalWidth : 0;
        const height = element instanceof HTMLVideoElement ? element.videoHeight : element instanceof HTMLImageElement ? element.naturalHeight : 0;
        if (!width || !height) continue;
        const scale = Math.min(canvas.width / width, canvas.height / height), w = width * scale, h = height * scale;
        context.save(); context.globalAlpha = (clip.style?.opacity ?? 100) / 100;
        context.drawImage(element as HTMLVideoElement | HTMLImageElement, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h); context.restore();
      }
      if (clip.type === "text") {
        const align = clip.style?.textAlign ?? "center", size = (clip.style?.fontSize ?? 32) * canvas.height / 720;
        context.save(); context.font = `bold ${size}px sans-serif`; context.textAlign = align; context.textBaseline = "middle";
        context.fillStyle = clip.style?.color ?? "#ffffff"; context.shadowColor = "#000000"; context.shadowBlur = 4;
        const x = align === "left" ? canvas.width * .05 : align === "right" ? canvas.width * .95 : canvas.width / 2;
        const lines = (clip.text ?? "").split("\n"); lines.forEach((line, index) => context.fillText(line, x, canvas.height / 2 + (index - (lines.length - 1) / 2) * size * 1.2, canvas.width * .9));
        context.restore();
      }
    }
  };
  return { draw, dispose: cleanup };
}

export async function exportTimeline(document: TimelineDocument, options: { signal: AbortSignal; onProgress: (fraction: number, label: string) => void; onDiagnostic?: (event: string, detail: Record<string, unknown>) => void }) {
  if (typeof MediaRecorder === "undefined" || !HTMLCanvasElement.prototype.captureStream || typeof AudioContext === "undefined") throw new Error("This browser does not support video recording. Use a current Chrome, Edge, Firefox or Safari.");
  const format = selectRecordingFormat(mime => MediaRecorder.isTypeSupported(mime));
  options.onDiagnostic?.("format", { selected: format?.mime, duration: timelineDuration(document.clips) });
  if (!format) throw new Error("No supported WebM or MP4 recording codec is available");
  if (!document.clips.length) throw new Error("Add at least one clip before exporting");
  const canvas = window.document.createElement("canvas"); canvas.width = 1280; canvas.height = 720;
  const audio = new AudioContext();
  const destination = audio.createMediaStreamDestination();
  // Keep a continuous audio sample clock during silent gaps and encoder
  // startup. A destination fed only by paused elements may emit no samples.
  const silence = audio.createConstantSource(); silence.offset.value = 0; silence.connect(destination);
  let renderer: Awaited<ReturnType<typeof createTimelineRenderer>> | undefined;
  let stream: MediaStream | undefined, recorder: MediaRecorder | undefined, frame = 0;
  let drawTimer: ReturnType<typeof setTimeout> | undefined;
  try {
    await audio.resume();
    silence.start();
    renderer = await createTimelineRenderer(document, canvas, { signal: options.signal, audioContext: audio, destination,
      onLoad: fraction => options.onProgress(fraction * .1, "Loading media") });
    if (options.signal.aborted) throw abortError();
    renderer.draw(document, 0, false);
    stream = canvas.captureStream(30); destination.stream.getAudioTracks().forEach(track => stream!.addTrack(track));
    options.onDiagnostic?.("stream", { audioState: audio.state, tracks: stream.getTracks().map(track => ({ kind: track.kind, readyState: track.readyState, enabled: track.enabled, muted: track.muted })) });
    recorder = new MediaRecorder(stream, { mimeType: format.mime, videoBitsPerSecond: 4_000_000 });
    const chunks: Blob[] = []; let recordedBytes = 0;
    const duration = timelineDuration(document.clips), recording = recorder;
    let frameCount = 0, warmupFrames = 0;
    await new Promise<void>((resolve, reject) => {
      let failure: Error | undefined;
      let started: number | undefined;
      let startupTimer: ReturnType<typeof setTimeout> | undefined;
      let stopTimer: ReturnType<typeof setTimeout> | undefined;
      const fail = (error: Error) => { failure = error; if (recording.state !== "inactive") recording.stop(); else { cleanup(); reject(error); } };
      const abort = () => fail(abortError());
      const visibility = () => { if (window.document.hidden) fail(new Error("Export stopped because the tab was hidden. Keep this tab visible during real-time recording.")); };
      recording.ondataavailable = event => { options.onDiagnostic?.("data", { bytes: event.data.size, mime: event.data.type, timecode: event.timecode, frames: frameCount }); if (event.data.size) { chunks.push(event.data); recordedBytes += event.data.size; if (recordedBytes > 512 * 1024 * 1024) fail(new Error("Export exceeded the 512 MiB browser recording limit")); } };
      recording.onerror = () => fail(new Error("The browser failed to record this timeline"));
      const cleanup = () => { clearTimeout(startupTimer); clearTimeout(stopTimer); clearTimeout(drawTimer); options.signal.removeEventListener("abort", abort); window.document.removeEventListener("visibilitychange", visibility); };
      recording.onstop = () => { options.onDiagnostic?.("stop", { bytes: recordedBytes, frames: frameCount, warmupFrames, audioTime: audio.currentTime, mime: recording.mimeType, state: recording.state, recordedSeconds: started === undefined ? 0 : (performance.now() - started) / 1000 }); cleanup(); failure ? reject(failure) : resolve(); };
      options.signal.addEventListener("abort", abort, { once: true }); window.document.addEventListener("visibilitychange", visibility);
      const tick = () => {
        if (String(recording.state) === "inactive") return;
        const time = Math.min(duration, (performance.now() - started!) / 1000);
        if (time >= duration) { recording.stop(); return; }
        const beforeDraw = performance.now();
        frameCount++;
        try { renderer!.draw(document, time, true); } catch (error) { fail(error instanceof Error ? error : new Error("Rendering failed")); return; }
        (stream!.getVideoTracks?.()[0] as CanvasCaptureMediaStreamTrack | undefined)?.requestFrame?.();
        options.onProgress(.1 + .9 * time / duration, "Recording in real time — keep this tab visible");
        if (recording.state === "inactive") return;
        drawTimer = setTimeout(tick, Math.max(1, 1000 / 30 - (performance.now() - beforeDraw)));
      };
      // start() only queues encoder startup. Timing the clip before onstart
      // can stop short exports before a single encoded frame is accepted.
      recording.onstart = () => {
        options.onDiagnostic?.("start", { mime: recording.mimeType, state: recording.state });
        if (recording.state === "inactive") return;
        clearTimeout(startupTimer); started = performance.now();
        stopTimer = setTimeout(() => { if (recording.state !== "inactive") recording.stop(); }, duration * 1000);
        cancelAnimationFrame(frame);
        try { renderer!.draw(document, 0, true); drawTimer = setTimeout(tick, 1000 / 30); } catch (error) { fail(error instanceof Error ? error : new Error("Rendering failed")); }
      };
      startupTimer = setTimeout(() => fail(new Error("The browser video encoder did not start. Try again with this tab active.")), 15000);
      options.onProgress(.1, "Starting video encoder");
      const prime = () => {
        if (started !== undefined || recording.state === "inactive") return;
        warmupFrames++;
        try { renderer!.draw(document, 0, false); (stream!.getVideoTracks?.()[0] as CanvasCaptureMediaStreamTrack | undefined)?.requestFrame?.(); }
        catch (error) { fail(error instanceof Error ? error : new Error("Rendering failed")); return; }
        frame = requestAnimationFrame(prime);
      };
      try { recording.start(100); prime(); } catch (error) { fail(error instanceof Error ? error : new Error("Recording failed")); }
    });
    if (options.signal.aborted) throw abortError();
    const actualMime = recorder.mimeType || format.mime;
    const blob = new Blob(chunks, { type: actualMime }); if (!blob.size) throw new Error("The browser returned an empty recording");
    return { blob, mime: actualMime, extension: actualMime.startsWith("video/mp4") ? "mp4" : "webm" };
  } finally {
    cancelAnimationFrame(frame); clearTimeout(drawTimer); if (recorder && recorder.state !== "inactive") recorder.stop();
    renderer?.dispose(); stream?.getTracks().forEach(track => track.stop()); destination.stream.getTracks().forEach(track => track.stop());
    try { silence.stop(); } catch { /* resume may have failed before source start */ } silence.disconnect(); await audio.close();
  }
}
