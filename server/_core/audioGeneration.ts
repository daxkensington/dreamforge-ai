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

import { storagePut } from "server/storage";
import { ENV } from "./env";

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

// ─── Replicate Client ───────────────────────────────────────────────────────

const REPLICATE_API_URL = "https://api.replicate.com/v1/predictions";

// Model versions on Replicate
const REPLICATE_MODELS = {
  musicgen: "meta/musicgen:671ac645ce5e552cc63a54a2bbff63fcf798043055d2dac5fc9e36a837eedxxx",
  audiogen: "meta/audiogen:0a9c7e04e09560e9b740eeeda3e24e22fc0dc92e9e3e68ef62387a58b4633ace",
  bark: "suno-ai/bark:b76242b40d67c76ab6742e987628a2a9ac019e11d56571d42727c2cb41f00bea",
} as const;

interface ReplicateInput {
  [key: string]: unknown;
}

async function replicatePredict(
  modelVersion: string,
  input: ReplicateInput
): Promise<string> {
  if (!ENV.replicateApiToken) {
    throw new Error("REPLICATE_API_TOKEN is not configured");
  }

  // Create prediction
  const createResponse = await fetch(REPLICATE_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ENV.replicateApiToken}`,
      "Content-Type": "application/json",
      Prefer: "wait",
    },
    body: JSON.stringify({
      version: modelVersion,
      input,
    }),
  });

  if (!createResponse.ok) {
    const detail = await createResponse.text().catch(() => "");
    throw new Error(
      `Replicate prediction failed (${createResponse.status})${detail ? `: ${detail}` : ""}`
    );
  }

  const prediction = (await createResponse.json()) as {
    id: string;
    status: string;
    output: string | string[] | null;
    error: string | null;
    urls: { get: string };
  };

  // If status is not "succeeded", poll for completion
  if (prediction.status !== "succeeded") {
    return await pollReplicatePrediction(prediction.urls.get);
  }

  const output = prediction.output;
  if (!output) {
    throw new Error("Replicate returned no output");
  }

  return typeof output === "string" ? output : output[0];
}

async function pollReplicatePrediction(getUrl: string): Promise<string> {
  const maxAttempts = 120; // 10 minutes with 5s intervals
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((resolve) => setTimeout(resolve, 5000));

    const response = await fetch(getUrl, {
      headers: {
        Authorization: `Bearer ${ENV.replicateApiToken}`,
      },
    });

    if (!response.ok) continue;

    const prediction = (await response.json()) as {
      status: string;
      output: string | string[] | null;
      error: string | null;
    };

    if (prediction.status === "succeeded") {
      const output = prediction.output;
      if (!output) throw new Error("Replicate returned no output");
      return typeof output === "string" ? output : output[0];
    }

    if (prediction.status === "failed" || prediction.status === "canceled") {
      throw new Error(
        `Replicate prediction ${prediction.status}: ${prediction.error ?? "Unknown error"}`
      );
    }
  }

  throw new Error("Replicate prediction timed out after 10 minutes");
}

async function downloadAndStore(
  remoteUrl: string,
  filename: string
): Promise<string> {
  const response = await fetch(remoteUrl);
  if (!response.ok) {
    throw new Error(`Failed to download audio from Replicate: ${response.status}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  const { url } = await storagePut(
    `audio/${filename}`,
    buffer,
    "audio/wav"
  );
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

  const outputUrl = await replicatePredict(REPLICATE_MODELS.audiogen, {
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

  const outputUrl = await replicatePredict(REPLICATE_MODELS.musicgen, {
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

  const outputUrl = await replicatePredict(REPLICATE_MODELS.bark, {
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
  const outputUrl = await replicatePredict(REPLICATE_MODELS.musicgen, {
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
  const outputUrl = await replicatePredict(
    // ffmpeg on Replicate for merging
    "andreasjansson/ffmpeg:c1e0e2a3f6e0a3e2b4c5d6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7",
    {
      audio_url: audioUrl,
      video_url: videoUrl,
      command: `-i {video} -i {audio} -c:v copy -c:a aac -map 0:v:0 -map 1:a:0 -shortest {output}`,
    }
  );

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
