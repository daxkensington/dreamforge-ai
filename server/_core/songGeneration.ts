/**
 * AI Song Creation — lyrics generation via LLM + full song with vocals via MiniMax Music 2.5
 *
 * Pipeline:
 *   1. User provides concept/mood/genre → LLM writes lyrics with structure tags
 *   2. Lyrics + style description → MiniMax Music 2.5 generates full song with vocals
 *   3. Song stored to R2, URL returned
 */

import { storagePut } from "../storage";
import { invokeLLM } from "./llm";
import { ENV } from "./env";
import { replicatePredict, downloadBuffer } from "./replicate";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface LyricsRequest {
  concept: string;
  // Multi-value: first genre/mood dominates, others are blended. Keeping
  // single-value variants for back-compat with older clients.
  genre: string;
  genres?: string[];
  mood: string;
  moods?: string[];
  songStructure?: string; // "verse-chorus-verse-chorus-bridge-chorus" etc.
  language?: string;
  era?: string; // "80s", "90s", "y2k", "modern", "retro"
}

export interface LyricsResult {
  title: string;
  lyrics: string;
  structure: string[];
  suggestedStyle: string;
}

export interface SongRequest {
  lyrics: string;
  genre: string;
  genres?: string[];          // optional blend — first = primary
  mood: string;
  moods?: string[];           // optional blend
  tempo?: string;             // "slow", "medium", "fast", or BPM like "120"
  bpm?: number;               // explicit BPM override (40-220)
  vocalGender?: string;       // "male", "female", "duet", "choir", "instrumental"
  vocalStyle?: string;        // legacy single-field (kept for back-compat)
  vocalCharacter?: string;    // "smooth", "powerful", "raspy", "whisper", "belt", "airy", "gritty"
  instrumentFocus?: string[]; // ["piano", "acoustic-guitar", "electric-guitar", "synth", "strings", "brass", "drums", "bass"]
  instrumentStyle?: string;   // free-text additional instrument description
  era?: string;               // "80s", "90s", "y2k", "modern", "retro", "timeless"
  key?: string;               // "C major", "A minor", etc. (optional)
  timeSignature?: string;     // "4/4", "3/4", "6/8", "7/8"
  referenceArtists?: string;  // free-text "similar to X, Y influence"
  instrumentalOnly?: boolean; // skip vocals entirely
}

export interface SongResult {
  songUrl: string;
  model: string;
  metadata: Record<string, unknown>;
}

// ─── Lyrics Generation (via LLM) ───────────────────────────────────────────

const GENRE_STYLES: Record<string, string> = {
  pop: "catchy pop melodies, synthesizers, upbeat rhythm",
  rock: "electric guitars, driving drums, powerful vocals",
  hiphop: "hip-hop beats, rap flow, 808 bass, trap hi-hats",
  rnb: "smooth R&B, soulful vocals, groove bass, neo-soul production",
  reggae: "reggae riddim, offbeat guitar skank, deep bass, one drop drums, island vibes",
  dancehall: "dancehall riddim, heavy bass, digital production, Caribbean energy, patois flow",
  afrobeats: "afrobeats percussion, log drums, shakers, groovy bass, West African rhythm, amapiano influence",
  electronic: "electronic dance music, synthesizers, heavy bass drop, festival energy",
  house: "four-on-the-floor house beat, deep bass, piano stabs, vocal chops, club energy",
  techno: "driving techno, industrial synths, relentless kick drum, dark warehouse energy",
  drill: "UK drill beats, sliding 808 bass, dark piano, aggressive flow",
  trap: "trap beats, heavy 808s, hi-hat rolls, atmospheric synths, hard-hitting",
  lofi: "lo-fi hip hop, chill beats, vinyl crackle, mellow piano, jazz samples",
  jazz: "jazz piano, saxophone, swing rhythm, improvisation, smooth",
  blues: "12-bar blues, electric guitar bends, harmonica, soulful vocals, gritty",
  indie: "indie alternative, lo-fi production, dreamy guitars, introspective",
  country: "acoustic guitar, country twang, storytelling vocals, fiddle, steel guitar",
  latin: "latin rhythms, tropical beats, Spanish vocals, congas, brass",
  reggaeton: "reggaeton dembow beat, perreo bass, Latin trap influence, Spanish vocals",
  kpop: "K-pop production, catchy hooks, dance break, polished vocals, synth-heavy",
  soul: "soul music, gospel harmonies, organ, warm vocals, Motown influence",
  gospel: "gospel choir, powerful vocals, organ, piano, uplifting spiritual energy",
  funk: "funky bass, wah guitar, groovy drums, brass section, James Brown energy",
  disco: "four-on-the-floor disco beat, string arrangements, funky bass, mirror ball energy",
  metal: "heavy metal, distorted guitars, aggressive drums, powerful vocals, double bass pedal",
  punk: "fast punk rock, power chords, raw energy, shouted vocals, short and aggressive",
  folk: "acoustic folk, fingerpicking guitar, banjo, harmonica, storytelling, earthy",
  classical: "orchestral arrangement, piano, strings, timpani, classical composition",
  ambient: "ambient textures, ethereal pads, reverb, atmospheric, meditative soundscape",
  phonk: "phonk beats, chopped Memphis samples, distorted 808s, dark cowbell, drift energy",
};

export async function generateLyrics(request: LyricsRequest): Promise<LyricsResult> {
  const structure = request.songStructure || "verse-chorus-verse-chorus-bridge-chorus";
  // Blend multi-genre/mood when provided (first = primary, others = accents).
  const genres = request.genres?.length ? request.genres : [request.genre];
  const moods = request.moods?.length ? request.moods : [request.mood];
  const genreLine = genres.length > 1
    ? `${genres[0]} (with ${genres.slice(1).join(" + ")} influences)`
    : genres[0];
  const moodLine = moods.length > 1 ? moods.join(" + ") : moods[0];

  const prompt = `You are a professional songwriter. Write song lyrics for the following concept:

Concept: ${request.concept}
Genre: ${genreLine}
Mood: ${moodLine}
Language: ${request.language || "English"}
${request.era ? `Era / vibe: ${request.era}\n` : ""}Structure: ${structure}

IMPORTANT FORMATTING RULES:
- Use MiniMax Music structure tags: [verse], [chorus], [bridge], [pre-chorus], [outro], [intro]
- Each section should be on its own line with the tag before it
- Write emotionally compelling, genre-appropriate lyrics
- Keep verses 4-6 lines, choruses 4 lines, bridge 2-4 lines
- The chorus should be catchy and memorable

Output ONLY valid JSON with this exact format:
{
  "title": "Song Title",
  "lyrics": "[intro]\\n(instrumental)\\n\\n[verse]\\nFirst verse line one\\nFirst verse line two\\n...\\n\\n[chorus]\\nChorus line one\\n...",
  "structure": ["intro", "verse", "chorus", "verse", "chorus", "bridge", "chorus", "outro"],
  "suggestedStyle": "A brief style description for the music generator, e.g. upbeat pop with synth pads and acoustic guitar"
}`;

  const result = await invokeLLM({
    messages: [
      { role: "system", content: "You are a Grammy-winning songwriter. Output ONLY valid JSON, no markdown." },
      { role: "user", content: prompt },
    ],
    maxTokens: 2000,
    response_format: { type: "json_object" },
  });

  const content = result.choices[0]?.message?.content;
  if (!content) throw new Error("LLM returned no lyrics content");

  try {
    const parsed = JSON.parse(typeof content === "string" ? content : JSON.stringify(content));
    return {
      title: parsed.title || "Untitled",
      lyrics: parsed.lyrics || "",
      structure: parsed.structure || [],
      suggestedStyle: parsed.suggestedStyle || `${request.genre} ${request.mood}`,
    };
  } catch {
    // If JSON parsing fails, return raw content as lyrics
    return {
      title: "Untitled",
      lyrics: typeof content === "string" ? content : "",
      structure: structure.split("-"),
      suggestedStyle: `${request.genre} ${request.mood}`,
    };
  }
}

// ─── Song Generation (MiniMax Music 2.5 via Replicate) ──────────────────────

export async function generateSong(request: SongRequest): Promise<SongResult> {
  if (!ENV.replicateApiToken) {
    throw new Error("REPLICATE_API_TOKEN is not configured. Required for song generation.");
  }

  // Blend multi-genre/mood. First entry dominates; rest are accents.
  const genres = request.genres?.length ? request.genres : [request.genre];
  const moods = request.moods?.length ? request.moods : [request.mood];
  const primaryGenre = genres[0];
  const genreStyle = GENRE_STYLES[primaryGenre] || primaryGenre;
  const genreAccents = genres.slice(1).map((g) => GENRE_STYLES[g] || g).filter(Boolean);
  const genreBlend = genreAccents.length
    ? `${genreStyle}, blended with ${genreAccents.join(" and ")}`
    : genreStyle;
  const moodBlend = moods.length > 1 ? moods.join(" and ") : moods[0];

  // BPM override wins over preset; presets map to ranges.
  const tempoDesc = request.bpm
    ? `${request.bpm} BPM, ${request.bpm < 90 ? "relaxed" : request.bpm > 140 ? "energetic" : "steady"} tempo`
    : request.tempo === "slow" ? "60-80 BPM, slow tempo"
    : request.tempo === "fast" ? "140-170 BPM, fast energetic tempo"
    : request.tempo ? `${request.tempo} BPM` : "medium tempo";

  // Vocal description: new gender + character fields take precedence.
  const vocalGender = request.vocalGender || request.vocalStyle;
  const vocalBase = vocalGender === "male" ? "male vocals"
    : vocalGender === "female" ? "female vocals"
    : vocalGender === "duet" ? "male and female duet vocals"
    : vocalGender === "choir" ? "choir / group vocals"
    : vocalGender === "instrumental" ? "instrumental only, no vocals"
    : "vocals";
  const vocalDesc = request.instrumentalOnly || vocalGender === "instrumental"
    ? "instrumental only, no vocals"
    : request.vocalCharacter
      ? `${request.vocalCharacter} ${vocalBase}`
      : vocalBase;

  // Build supplementary descriptors
  const parts = [
    genreBlend,
    tempoDesc,
    vocalDesc,
    `${moodBlend} mood`,
  ];
  if (request.era) parts.push(`${request.era} era production aesthetic`);
  if (request.instrumentFocus?.length) {
    const focus = request.instrumentFocus.map((i) => i.replace(/-/g, " "));
    parts.push(`prominent ${focus.join(", ")}`);
  }
  if (request.key) parts.push(`in ${request.key}`);
  if (request.timeSignature && request.timeSignature !== "4/4") {
    parts.push(`${request.timeSignature} time signature`);
  }
  if (request.referenceArtists) parts.push(`reminiscent of ${request.referenceArtists}`);
  if (request.instrumentStyle) parts.push(request.instrumentStyle);

  const referenceAudio = parts.filter(Boolean).join(". ");

  // Generate via MiniMax Music 2.5 on Replicate (shared utility handles polling)
  const outputUrl = await replicatePredict({
    model: "minimax/music-2.5",
    input: {
      lyrics: request.lyrics,
      reference_audio_text: referenceAudio,
    },
    maxAttempts: 120,
    pollInterval: 3000,
  });

  // Download and store to R2
  const buffer = await downloadBuffer(outputUrl);
  const ext = "mp3";

  const { url } = await storagePut(
    `songs/song_${Date.now()}.${ext}`,
    buffer,
    "audio/mpeg",
  );

  return {
    songUrl: url,
    model: "minimax-music-2.5",
    metadata: {
      genres,
      moods,
      tempo: request.tempo,
      bpm: request.bpm,
      vocalGender,
      vocalCharacter: request.vocalCharacter,
      instrumentFocus: request.instrumentFocus,
      era: request.era,
      key: request.key,
      timeSignature: request.timeSignature,
      referenceArtists: request.referenceArtists,
      instrumentalOnly: request.instrumentalOnly,
      referenceAudioText: referenceAudio,
    },
  };
}
