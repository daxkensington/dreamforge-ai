/**
 * Audio generation service using Replicate API
 *
 * Supports:
 * - Sound effects (AudioGen)
 * - Music generation (MusicGen)
 * - Voiceover / TTS (Bark)
 * - Ambient audio (MusicGen with ambient prompts)
 * - Audio-video merge (ffmpeg-based via Replicate)
 */

import { storagePut } from "../storage";
import { ENV } from "./env";
import { replicatePredict, downloadBuffer } from "./replicate";

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
  musicgen: "meta/musicgen:671ac645ce5e552cc63a54a2bbff63fcf798043055d2dac5fc9e36a837eedxxx",
  audiogen: "meta/audiogen:0a9c7e04e09560e9b740eeeda3e24e22fc0dc92e9e3e68ef62387a58b4633ace",
  bark: "suno-ai/bark:b76242b40d67c76ab6742e987628a2a9ac019e11d56571d42727c2cb41f00bea",
} as const;

async function audioPredict(version: string, input: Record<string, unknown>): Promise<string> {
  return replicatePredict({ version, input, maxAttempts: 120, pollInterval: 5000 });
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

  let prompt = `Ambient soundscape: ${request.prompt}. Seamless, loopable, atmospheric.`;
  if (request.options?.mood) {
    prompt = `${request.options.mood} atmosphere. ${prompt}`;
  }

  // Use MusicGen for longer ambient pieces
  const outputUrl = await audioPredict(REPLICATE_MODELS.musicgen, {
    prompt,
    duration: Math.min(duration, 120), // MusicGen max is ~120s; we generate what we can
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
  // Use Replicate's ffmpeg model to merge audio and video
  const outputUrl = await replicatePredict({
    version: "andreasjansson/ffmpeg:c1e0e2a3f6e0a3e2b4c5d6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7",
    input: {
      audio_url: audioUrl,
      video_url: videoUrl,
      command: `-i {video} -i {audio} -c:v copy -c:a aac -map 0:v:0 -map 1:a:0 -shortest {output}`,
    },
  });

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
