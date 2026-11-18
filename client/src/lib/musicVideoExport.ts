import { inspectTimelineFile } from "@/components/timeline/timelineMedia";
import { selectRecordingFormat } from "@shared/timeline";

const MAX_AUDIO_SECONDS = 600;
// Match the animation service's 100 MiB accepted output limit so a successfully
// paid animation is not rejected solely by a smaller exporter size policy.
const MAX_VIDEO_BYTES = 100 * 1024 * 1024;
const MAX_OUTPUT_BYTES = 512 * 1024 * 1024;

/** Check recording capabilities before a user can purchase a new clip. */
export function musicVideoSupportError(): string | null {
  try {
    if (typeof MediaRecorder === "undefined" || typeof AudioContext === "undefined" ||
        typeof HTMLCanvasElement === "undefined" || !HTMLCanvasElement.prototype.captureStream ||
        typeof HTMLVideoElement === "undefined" || !(HTMLVideoElement.prototype as HTMLVideoElement & { captureStream?: () => MediaStream }).captureStream ||
        typeof AbortSignal.any !== "function" || typeof AbortSignal.timeout !== "function" ||
        !selectRecordingFormat(mime => MediaRecorder.isTypeSupported(mime))) {
      return "This browser cannot export a music video with audio. Use a current Chrome browser; no credits were charged.";
    }
    return null;
  } catch {
    return "This browser cannot export a music video with audio. Use a current Chrome browser; no credits were charged.";
  }
}

/** Animation results use private, owner-authorized same-origin media paths. */
export function isOwnedAnimationUrl(url: string, userId: number): boolean {
  return Number.isSafeInteger(userId) && userId > 0 &&
    new RegExp(`^/api/media/animation/${userId}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.mp4$`, "i").test(url);
}

export async function inspectMusicAudio(file: File): Promise<number> {
  const info = await inspectTimelineFile(file);
  if (info.kind !== "audio") throw new Error("Choose an audio file.");
  if (info.duration > MAX_AUDIO_SECONDS) throw new Error("Choose a song of 10 minutes or less.");
  return info.duration;
}

function waitForMedia(element: HTMLMediaElement, event: string, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => finish(new Error("Media loading timed out.")), 30_000);
    const ready = () => finish();
    const failed = () => finish(new Error("This browser could not decode the selected media."));
    const aborted = () => finish(new DOMException("Export cancelled", "AbortError"));
    const finish = (error?: Error) => {
      clearTimeout(timer); element.removeEventListener(event, ready); element.removeEventListener("error", failed);
      signal.removeEventListener("abort", aborted); error ? reject(error) : resolve();
    };
    element.addEventListener(event, ready, { once: true }); element.addEventListener("error", failed, { once: true });
    signal.addEventListener("abort", aborted, { once: true }); if (signal.aborted) aborted();
  });
}

/** Fetch only a private, owner-authorized animation; never pass an arbitrary URL to a provider. */
async function loadOwnedVideo(path: string, userId: number, signal: AbortSignal): Promise<Blob> {
  if (!isOwnedAnimationUrl(path, userId)) throw new Error("Choose one of your completed animation clips.");
  const response = await fetch(path, { credentials: "same-origin", signal: AbortSignal.any([signal, AbortSignal.timeout(30_000)]) });
  if (!response.ok) throw new Error("Your saved animation could not be loaded. Sign in again or choose another clip.");
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Video streaming is unavailable in this browser.");
  const chunks: Uint8Array<ArrayBuffer>[] = []; let bytes = 0;
  try {
    while (true) {
      const part = await reader.read(); if (part.done) break;
      bytes += part.value.byteLength;
      if (bytes > MAX_VIDEO_BYTES) { await reader.cancel(); throw new Error("The animation exceeds the 100 MiB browser export limit."); }
      chunks.push(part.value as Uint8Array<ArrayBuffer>);
    }
  } finally { reader.releaseLock(); }
  if (!bytes) throw new Error("Your saved animation is empty.");
  return new Blob(chunks, { type: "video/mp4" });
}

/** Verify the actual encoded file before presenting it as a completed export. */
async function validateMusicRecording(blob: Blob, expectedDuration: number, signal: AbortSignal): Promise<void> {
  const url = URL.createObjectURL(blob), video = document.createElement("video");
  let stream: MediaStream | undefined;
  try {
    video.preload = "auto"; video.muted = true; video.playsInline = true;
    const metadata = waitForMedia(video, "loadedmetadata", signal); video.src = url; video.load(); await metadata;
    if (!video.videoWidth || !video.videoHeight) throw new Error("The recording has no playable video track.");
    if (!Number.isFinite(video.duration)) {
      const seek = waitForMedia(video, "seeked", signal); video.currentTime = 1e10; await seek;
    }
    if (!Number.isFinite(video.duration) || video.duration < expectedDuration - 0.35 || video.duration > expectedDuration + 3) {
      throw new Error("The recording is incomplete. Retry export without spending more credits.");
    }
    if (video.currentTime > 0) { const seek = waitForMedia(video, "seeked", signal); video.currentTime = 0; await seek; }
    await video.play();
    const capture = (video as HTMLVideoElement & { captureStream?: () => MediaStream }).captureStream;
    if (!capture) throw new Error("This browser cannot verify the recorded audio track. Use a current Chrome browser.");
    stream = capture.call(video);
    if (!stream.getAudioTracks().length || !stream.getVideoTracks().length) throw new Error("The recording is missing video or audio. Retry export without spending more credits.");
  } finally {
    stream?.getTracks().forEach(track => track.stop()); video.pause(); video.removeAttribute("src"); video.load(); URL.revokeObjectURL(url);
  }
}

/** Loop a five-second animation over the entire song and record locally. No credits are spent here. */
export async function exportMusicVideo(input: {
  videoUrl: string; userId: number; audio: File; signal: AbortSignal;
  onProgress: (fraction: number) => void;
}): Promise<{ blob: Blob; extension: string; mime: string }> {
  const supportError = musicVideoSupportError();
  if (supportError) throw new Error(supportError);
  const format = selectRecordingFormat(mime => MediaRecorder.isTypeSupported(mime));
  if (!format) throw new Error("This browser has no supported video and audio recording codec.");
  if (!isOwnedAnimationUrl(input.videoUrl, input.userId)) throw new Error("Choose one of your completed animation clips.");
  const audioContext = new AudioContext();
  const video = document.createElement("video"), audio = document.createElement("audio");
  const urls: string[] = []; let stream: MediaStream | undefined; let recorder: MediaRecorder | undefined;
  let audioSource: MediaElementAudioSourceNode | undefined; let frame: number | undefined;
  try {
    // Resume immediately on the user's click, before asynchronous loading can consume activation.
    await audioContext.resume();
    const duration = await inspectMusicAudio(input.audio);
    const videoBlob = await loadOwnedVideo(input.videoUrl, input.userId, input.signal);
    const videoObject = URL.createObjectURL(videoBlob), audioObject = URL.createObjectURL(input.audio);
    urls.push(videoObject, audioObject);
    video.muted = true; video.loop = true; video.playsInline = true; video.preload = "auto";
    audio.preload = "auto";
    const readyVideo = waitForMedia(video, "canplay", input.signal), readyAudio = waitForMedia(audio, "canplay", input.signal);
    video.src = videoObject; audio.src = audioObject; video.load(); audio.load();
    await Promise.all([readyVideo, readyAudio]);
    if (!video.videoWidth || !video.videoHeight || !Number.isFinite(video.duration) || video.duration < 0.1) {
      throw new Error("The saved animation does not contain a playable video.");
    }
    const canvas = document.createElement("canvas"); canvas.width = 1280; canvas.height = 720;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas rendering is unavailable.");
    const destination = audioContext.createMediaStreamDestination();
    audioSource = audioContext.createMediaElementSource(audio); audioSource.connect(destination);
    stream = canvas.captureStream(30);
    for (const track of destination.stream.getAudioTracks()) stream.addTrack(track);
    if (!stream.getVideoTracks().length || !stream.getAudioTracks().length) throw new Error("The browser could not create video and audio tracks.");
    recorder = new MediaRecorder(stream, { mimeType: format.mime, videoBitsPerSecond: 4_000_000 });
    const recording = recorder, chunks: Blob[] = []; let bytes = 0;
    await new Promise<void>((resolve, reject) => {
      let failure: Error | undefined, started = false, finished = false;
      let timeout: ReturnType<typeof setTimeout> | undefined;
      const cleanup = () => { clearTimeout(timeout); input.signal.removeEventListener("abort", abort); document.removeEventListener("visibilitychange", visibility); audio.removeEventListener("ended", ended); audio.removeEventListener("error", mediaError); video.removeEventListener("error", mediaError); };
      const finish = (error?: Error) => {
        if (finished) return;
        failure = error; finished = true;
        if (recording.state !== "inactive") recording.stop(); else { cleanup(); error ? reject(error) : resolve(); }
      };
      const abort = () => finish(new DOMException("Export cancelled", "AbortError"));
      const visibility = () => { if (document.hidden) finish(new Error("Keep this tab visible while the music video is recording.")); };
      const ended = () => finish();
      const mediaError = () => finish(new Error("Media playback failed during export."));
      recording.ondataavailable = event => { if (event.data.size) { bytes += event.data.size; if (bytes > MAX_OUTPUT_BYTES) { finish(new Error("Export exceeded the 512 MiB browser recording limit.")); return; } chunks.push(event.data); } };
      recording.onerror = () => finish(new Error("The browser failed to record the music video."));
      recording.onstop = () => { cleanup(); failure ? reject(failure) : resolve(); };
      input.signal.addEventListener("abort", abort, { once: true }); document.addEventListener("visibilitychange", visibility);
      audio.addEventListener("ended", ended, { once: true }); audio.addEventListener("error", mediaError); video.addEventListener("error", mediaError);
      const draw = () => {
        if (finished) return;
        try {
          if (started && (audioContext.state !== "running" || stream!.getTracks().some(track => track.readyState !== "live"))) {
            finish(new Error("Audio or video recording stopped. Retry export without spending more credits.")); return;
          }
          context.fillStyle = "black"; context.fillRect(0, 0, canvas.width, canvas.height);
          const scale = Math.min(canvas.width / video.videoWidth, canvas.height / video.videoHeight);
          const width = video.videoWidth * scale, height = video.videoHeight * scale;
          context.drawImage(video, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height);
          if (started) input.onProgress(Math.min(1, audio.currentTime / duration));
          frame = requestAnimationFrame(draw);
        } catch { finish(new Error("Could not render the animation frame.")); }
      };
      if (input.signal.aborted) return abort();
      try {
        draw(); recording.start(1000);
        timeout = setTimeout(() => finish(new Error("Playback stalled. Retry the export without spending more credits.")), (duration + 30) * 1000);
        void Promise.all([video.play(), audio.play()]).then(() => { started = true; }).catch(() => finish(new Error("Playback was blocked. Click Export again and keep this tab visible.")));
      } catch { finish(new Error("The browser could not start recording.")); }
    });
    if (!chunks.length || !bytes) throw new Error("The recording was empty. Retry the export.");
    const blob = new Blob(chunks, { type: recording.mimeType || format.mime });
    await validateMusicRecording(blob, duration, input.signal);
    return { blob, extension: format.extension, mime: recording.mimeType || format.mime };
  } finally {
    if (frame !== undefined) cancelAnimationFrame(frame);
    if (recorder && recorder.state !== "inactive") recorder.stop();
    video.pause(); audio.pause(); video.removeAttribute("src"); audio.removeAttribute("src"); video.load(); audio.load();
    audioSource?.disconnect(); stream?.getTracks().forEach(track => track.stop());
    urls.forEach(url => URL.revokeObjectURL(url));
    await audioContext.close();
  }
}
