/**
 * Audio generation service — self-hosted on RunPod (MusicGen/AudioGen)
 * with Replicate API fallback.
 *
 * Supports:
 * - Sound effects (AudioGen) — RunPod first, Replicate fallback
 * - Music generation (MusicGen) — RunPod first, Replicate fallback
 * - Voiceover / TTS (Bark) — Replicate only (not self-hosted yet)
 * - Ambient audio (MusicGen with ambient prompts)
 * - Audio-video merge (ffmpeg-based via Replicate)
 */

import { storagePut } from "../storage";
import { ENV } from "./env";
import { replicatePredict, downloadBuffer } from "./replicate";
import { isRunPodAvailable, runpodMusicGen, runpodAudioGen, runpodBarkTTS } from "./runpod";
import { falRun, isFalAvailable, type FalFile } from "./fal";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface AudioGenerationRequest {
  type: "sfx" | "music" | "voiceover" | "ambient";
  prompt: string;
  duration: number; // seconds
  options?: {
    tempo?: number;
    mood?: string;
    style?: string;
    voiceId?: string; // for voiceover
    syncToVideo?: string; // video URL to sync audio to
  };
}

export interface AudioGenerationResult {
  audioUrl: string;
  duration: number;
  model: string;
  metadata: Record<string, unknown>;
}

// ─── Replicate Model Versions ───────────────────────────────────────────────

const REPLICATE_MODELS = {
  musicgen: "meta/musicgen:b05b1dff1d8c6dc63d14b0cdb42135571e41c36ba5eeebb2b1d37dc8e3baa3c5",
  audiogen: "meta/audiogen:0a9c7e04e09560e9b740eeeda3e24e22fc0dc92e9e3e68ef62387a58b4633ace",
  bark: "suno-ai/bark:b76242b40d67c76ab6742e987628a2a9ac019e11d56571d42727c2cb41f00bea",
} as const;

async function audioPredict(version: string, input: Record<string, unknown>): Promise<string> {
  return replicatePredict({ version, input, maxAttempts: 120, pollInterval: 5000 });
}

/**
 * Instrumental music via fal.ai ACE-Step — middle fallback between RunPod
 * MusicGen and Replicate MusicGen (the latter dead since the 2026-06 token
 * expiry). `[inst]` lyrics = instrumental-only, tags carry the style prompt.
 */
async function falInstrumentalMusic(prompt: string, duration: number): Promise<string> {
  const result = await falRun<{ audio: FalFile }>(
    "fal-ai/ace-step",
    { tags: prompt, lyrics: "[inst]", duration },
    { pollInterval: 3000, maxPolls: 100 },
  );
  if (!result.audio?.url) throw new Error("fal.ai ace-step returned no audio");
  return result.audio.url;
}

async function downloadAndStore(remoteUrl: string, filename: string): Promise<string> {
  const buffer = await downloadBuffer(remoteUrl);
  const { url } = await storagePut(`audio/${filename}`, buffer, "audio/wav");
  return url;
}

// ─── Generation Functions ───────────────────────────────────────────────────

export async function generateSoundEffect(
  request: AudioGenerationRequest
): Promise<AudioGenerationResult> {
  const duration = Math.min(Math.max(request.duration, 1), 10);

  const prompt = request.options?.style
    ? `${request.options.style} style: ${request.prompt}`
    : request.prompt;

  // Try self-hosted AudioGen on RunPod first (~95% cheaper)
  if (isRunPodAvailable()) {
    try {
      const buffer = await runpodAudioGen(prompt, duration);
      const { url } = await storagePut(`audio/sfx_${Date.now()}.wav`, buffer, "audio/wav");
      return {
        audioUrl: url,
        duration,
        model: "audiogen-selfhosted",
        metadata: { type: "sfx", originalPrompt: request.prompt, style: request.options?.style ?? null },
      };
    } catch (err: any) {
      console.warn("[AudioGen] RunPod failed, falling back to Replicate:", err.message);
    }
  }

  // Fallback: Replicate API
  const outputUrl = await audioPredict(REPLICATE_MODELS.audiogen, {
    prompt,
    duration,
  });

  const storedUrl = await downloadAndStore(
    outputUrl,
    `sfx_${Date.now()}.wav`
  );

  return {
    audioUrl: storedUrl,
    duration,
    model: "audiogen",
    metadata: {
      type: "sfx",
      originalPrompt: request.prompt,
      style: request.options?.style ?? null,
    },
  };
}

export async function generateMusic(
  request: AudioGenerationRequest
): Promise<AudioGenerationResult> {
  const duration = Math.min(Math.max(request.duration, 10), 120);

  let prompt = request.prompt;
  if (request.options?.mood) {
    prompt = `${request.options.mood} mood: ${prompt}`;
  }
  if (request.options?.style) {
    prompt = `${request.options.style} style. ${prompt}`;
  }
  if (request.options?.tempo) {
    prompt = `${prompt}. ${request.options.tempo} BPM`;
  }

  // Try self-hosted MusicGen on RunPod first (~85% cheaper). Re-enabled
  // 2026-06-12: the worker image was rebuilt with soundfile (as
  // dreamforge-worker2 — the original CI build failed on a ghcr package
  // permission wall) and template 1bsqfwklgh repointed to it.
  if (isRunPodAvailable()) {
    try {
      const buffer = await runpodMusicGen(prompt, duration);
      const { url } = await storagePut(`audio/music_${Date.now()}.wav`, buffer, "audio/wav");
      return {
        audioUrl: url,
        duration,
        model: "musicgen-selfhosted",
        metadata: {
          type: "music",
          originalPrompt: request.prompt,
          mood: request.options?.mood ?? null,
          style: request.options?.style ?? null,
          tempo: request.options?.tempo ?? null,
        },
      };
    } catch (err: any) {
      console.warn("[MusicGen] RunPod failed, falling back to Replicate:", err.message);
    }
  }

  // Fallback: fal.ai ACE-Step (Replicate MusicGen is unreachable while the
  // token is dead — this keeps music generation alive in the meantime)
  if (isFalAvailable()) {
    try {
      const outputUrl = await falInstrumentalMusic(prompt, duration);
      const storedUrl = await downloadAndStore(outputUrl, `music_${Date.now()}.wav`);
      return {
        audioUrl: storedUrl,
        duration,
        model: "ace-step-fal",
        metadata: {
          type: "music",
          originalPrompt: request.prompt,
          mood: request.options?.mood ?? null,
          style: request.options?.style ?? null,
          tempo: request.options?.tempo ?? null,
        },
      };
    } catch (err: any) {
      if (!ENV.replicateApiToken) throw err;
      console.warn("[MusicGen] fal.ai ace-step failed, falling back to Replicate:", err.message);
    }
  }

  // Fallback: Replicate API
  const outputUrl = await audioPredict(REPLICATE_MODELS.musicgen, {
    prompt,
    duration,
    model_version: "stereo-large",
    output_format: "wav",
    normalization_strategy: "peak",
  });

  const storedUrl = await downloadAndStore(
    outputUrl,
    `music_${Date.now()}.wav`
  );

  return {
    audioUrl: storedUrl,
    duration,
    model: "musicgen",
    metadata: {
      type: "music",
      originalPrompt: request.prompt,
      mood: request.options?.mood ?? null,
      style: request.options?.style ?? null,
      tempo: request.options?.tempo ?? null,
    },
  };
}

export async function generateVoiceover(
  request: AudioGenerationRequest
): Promise<AudioGenerationResult> {
  const voicePreset = request.options?.voiceId ?? "v2/en_speaker_6";

  // Try self-hosted Bark TTS on RunPod first
  if (isRunPodAvailable()) {
    try {
      const buffer = await runpodBarkTTS(request.prompt, voicePreset);
      const { url } = await storagePut(`audio/voiceover_${Date.now()}.wav`, buffer, "audio/wav");
      return {
        audioUrl: url,
        duration: request.duration,
        model: "bark-selfhosted",
        metadata: { type: "voiceover", originalPrompt: request.prompt, voiceId: voicePreset },
      };
    } catch (err: any) {
      console.warn("[Bark] RunPod failed, falling back to Replicate:", err.message);
    }
  }

  // Fallback: Replicate API
  const outputUrl = await audioPredict(REPLICATE_MODELS.bark, {
    prompt: request.prompt,
    history_prompt: voicePreset,
    text_temp: 0.7,
    waveform_temp: 0.7,
  });

  const storedUrl = await downloadAndStore(
    outputUrl,
    `voiceover_${Date.now()}.wav`
  );

  return {
    audioUrl: storedUrl,
    duration: request.duration,
    model: "bark",
    metadata: {
      type: "voiceover",
      originalPrompt: request.prompt,
      voiceId: voicePreset,
    },
  };
}

export async function generateAmbient(
  request: AudioGenerationRequest
): Promise<AudioGenerationResult> {
  const duration = Math.min(Math.max(request.duration, 10), 300);
  const effectiveDuration = Math.min(duration, 120); // MusicGen max ~120s

  let prompt = `Ambient soundscape: ${request.prompt}. Seamless, loopable, atmospheric.`;
  if (request.options?.mood) {
    prompt = `${request.options.mood} atmosphere. ${prompt}`;
  }

  // Try self-hosted MusicGen on RunPod first
  if (isRunPodAvailable()) {
    try {
      const buffer = await runpodMusicGen(prompt, effectiveDuration);
      const { url } = await storagePut(`audio/ambient_${Date.now()}.wav`, buffer, "audio/wav");
      return {
        audioUrl: url,
        duration,
        model: "musicgen-selfhosted",
        metadata: { type: "ambient", originalPrompt: request.prompt, mood: request.options?.mood ?? null, loopable: true },
      };
    } catch (err: any) {
      console.warn("[Ambient] RunPod failed, falling back to Replicate:", err.message);
    }
  }

  // Fallback: fal.ai ACE-Step (keeps ambient alive while Replicate is dead)
  if (isFalAvailable()) {
    try {
      const outputUrl = await falInstrumentalMusic(prompt, effectiveDuration);
      const storedUrl = await downloadAndStore(outputUrl, `ambient_${Date.now()}.wav`);
      return {
        audioUrl: storedUrl,
        duration,
        model: "ace-step-fal",
        metadata: { type: "ambient", originalPrompt: request.prompt, mood: request.options?.mood ?? null, loopable: true },
      };
    } catch (err: any) {
      if (!ENV.replicateApiToken) throw err;
      console.warn("[Ambient] fal.ai ace-step failed, falling back to Replicate:", err.message);
    }
  }

  // Fallback: Replicate API
  const outputUrl = await audioPredict(REPLICATE_MODELS.musicgen, {
    prompt,
    duration: effectiveDuration,
    model_version: "stereo-large",
    output_format: "wav",
    normalization_strategy: "loudness",
  });

  const storedUrl = await downloadAndStore(
    outputUrl,
    `ambient_${Date.now()}.wav`
  );

  return {
    audioUrl: storedUrl,
    duration,
    model: "musicgen",
    metadata: {
      type: "ambient",
      originalPrompt: request.prompt,
      mood: request.options?.mood ?? null,
      loopable: true,
    },
  };
}

export async function syncAudioToVideo(
  audioUrl: string,
  videoUrl: string
): Promise<string> {
  // fal.ai ffmpeg merge first (Replicate token died 2026-06), Replicate
  // ffmpeg as fallback for when the token is rotated.
  let outputUrl: string | undefined;
  if (isFalAvailable()) {
    try {
      const result = await falRun<{ video: FalFile }>(
        "fal-ai/ffmpeg-api/merge-audio-video",
        { video_url: videoUrl, audio_url: audioUrl },
        { pollInterval: 2000, maxPolls: 90 },
      );
      if (!result.video?.url) throw new Error("fal.ai merge returned no video");
      outputUrl = result.video.url;
    } catch (err: any) {
      if (!ENV.replicateApiToken) throw err;
      console.warn("[AVSync] fal.ai merge failed, falling back to Replicate:", err.message);
    }
  }
  if (!outputUrl) {
    outputUrl = await replicatePredict({
      version: "andreasjansson/ffmpeg:c1e0e2a3f6e0a3e2b4c5d6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7",
      input: {
        audio_url: audioUrl,
        video_url: videoUrl,
        command: `-i {video} -i {audio} -c:v copy -c:a aac -map 0:v:0 -map 1:a:0 -shortest {output}`,
      },
    });
  }

  const storedUrl = await downloadAndStore(
    outputUrl,
    `merged_${Date.now()}.mp4`
  );

  return storedUrl;
}

// ─── Dispatcher ─────────────────────────────────────────────────────────────

export async function generateAudio(
  request: AudioGenerationRequest
): Promise<AudioGenerationResult> {
  switch (request.type) {
    case "sfx":
      return generateSoundEffect(request);
    case "music":
      return generateMusic(request);
    case "voiceover":
      return generateVoiceover(request);
    case "ambient":
      return generateAmbient(request);
    default:
      throw new Error(`Unknown audio type: ${request.type}`);
  }
}
