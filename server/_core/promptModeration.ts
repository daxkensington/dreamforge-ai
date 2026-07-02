/**
 * Prompt content-safety gate for image generation.
 *
 * This refuses two categories of ILLEGAL content BEFORE any prompt reaches a
 * generation model — most critically the unfiltered chain (generateUnfiltered)
 * which deliberately runs with the provider safety checker DISABLED:
 *
 *   1. Sexualization of minors (AI-CSAM — a federal crime; ~1.5M CyberTipline
 *      GAI reports in 2025). Refused for ALL tiers and regardless of any
 *      "uncensored" entitlement. No exception, ever.
 *   2. Sexual depictions of real, identifiable people (the TAKE IT DOWN Act
 *      criminalizes non-consensual intimate deepfakes; processors block them).
 *
 * Design notes:
 *   - This is a deliberately conservative keyword/heuristic gate. It WILL have
 *     false positives and is NOT a substitute for provider-side safety, human
 *     review, age-assurance, or NCMEC reporting. It is the documented first
 *     line of defense + the audit trail, which is what safe-harbor requires.
 *   - Two modes. `strictMinors:true` (the explicitly-unfiltered/NSFW path)
 *     refuses ANY reference to a minor, because there is no legitimate minor
 *     use in an adult generator. Standard mode (SFW tools / the public demo,
 *     which can still reach a no-safety self-hosted model) refuses only the
 *     minor+sexual co-occurrence and the unambiguous CSAM terms, so innocent
 *     prompts ("a child's drawing of a robot") are not over-blocked.
 *   - Matching normalizes case/spacing and applies light de-leeting so trivial
 *     evasions (l0li, j4ilbait) still trip the minor checks.
 */

import crypto from "crypto";

export type ModerationCategory = "csam" | "minor" | "deepfake";

export type ModerationVerdict =
  | { allowed: true }
  | { allowed: false; category: ModerationCategory; userMessage: string };

const CSAM_MESSAGE =
  "This prompt was blocked. Sexual content involving minors is illegal and strictly prohibited — no exceptions.";
const MINOR_MESSAGE =
  "This prompt was blocked. Uncensored generation is for fictional adults only; references to minors are not permitted.";
const DEEPFAKE_MESSAGE =
  "This prompt was blocked. DreamForgeX does not generate sexual or nude depictions of real, identifiable people. All subjects must be fictional.";

function deleet(s: string): string {
  return s
    .replace(/0/g, "o")
    .replace(/1/g, "i")
    .replace(/3/g, "e")
    .replace(/4/g, "a")
    .replace(/5/g, "s")
    .replace(/7/g, "t")
    .replace(/@/g, "a")
    .replace(/\$/g, "s");
}

function norm(raw: string): string {
  // space-pad so \b-style edges are easy, collapse separators used to split words
  return " " + raw.toLowerCase().replace(/[_\-.*]+/g, " ").replace(/\s+/g, " ").trim() + " ";
}

// Terms with NO legitimate adult use — block on bare presence, every mode.
const UNAMBIGUOUS_MINOR =
  /\b(loli|lolicon|shota|shotacon|jailbait|preteen|pre teen|prepubescent|prepubes|toddler|infant|newborn|kindergart\w*|preschool\w*|child ?porn|childporn|csam|cheese pizza|pedo\w*)\b/;

// Ambiguous minor references — block in strict mode, or in standard mode only
// when a sexual term co-occurs.
// NOTE: "young woman/man/lady" are deliberately NOT here — they are common,
// legitimate ADULT descriptors. Only "young girl/boy/teen" are minor-coded.
const MINOR_WORDS =
  /\b(child|children|kid|kids|minor|minors|underage|under age|young (girl|boy|teen)|little (girl|boy)|school ?girl|school ?boy|teen|teens|teenage|teenager|teenaged|adolescent\w*|juvenile|tween|grade ?school|middle ?school\w*|elementary|high ?school\w*|barely legal|baby (girl|boy))\b/;

// Numeric ages strictly under 18 (18/19/20+ deliberately excluded as adult).
const AGE_UNDER_18 =
  /\b([0-9]|1[0-7])\s*(yo|y\/o|yr|yrs|year|years)([ -]?old)?\b/;
const SPELLED_AGE_UNDER_18 =
  /\b(ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen)[ -]?(year|yr)s?[ -]?old\b/;

const SEXUAL =
  /\b(nude|nudes|nudity|naked|nsfw|porn|porno|pornographic|sex|sexy|sexual|sexually|erotic|erotica|hentai|xxx|explicit|nipple|nipples|breast|breasts|boobs|tits|areola|vagina|pussy|penis|dick|cock|cum|cumming|blowjob|handjob|fellatio|cunnilingus|masturbat\w*|orgasm|intercourse|topless|bottomless|lingerie|thong|fuck|fucking|anal|genital|genitalia|aroused|seductive|provocative|fetish|bdsm|bondage|cleavage|upskirt)\b/;

// Non-consensual / deepfake / "nudify" category — block on bare presence.
const DEEPFAKE =
  /\b(deep ?fake|deep ?nude|nudif(y|ier|ied|ication)|undress(ed|ing)?|strip (her|him|them|that) (naked|nude)|clothes remov(er|al)|remov(e|ing) (her|his|their|the) clothes|x[ -]?ray clothes|see ?through clothes|revenge porn|deep ?nudes?)\b/;

// Real public figures most at risk of non-consensual sexual deepfakes. Not
// exhaustive by design — paired with the generic real-person triggers below
// and extensible. Sexualizing any of these is refused.
const REAL_PERSON =
  /\b(taylor swift|scarlett johansson|emma watson|billie eilish|ariana grande|selena gomez|margot robbie|gal gadot|jenna ortega|sydney sweeney|millie bobby brown|zendaya|kim kardashian|kylie jenner|emma stone|natalie portman|megan fox|donald trump|joe biden|kamala harris|elon musk|aoc|alexandria ocasio|greta thunberg|hillary clinton)\b/;

const GENERIC_REAL_PERSON =
  /\b(celebrity|celeb|real person|real woman|real man|specific (person|woman|man|girl|guy)|my (ex|girlfriend|boyfriend|wife|husband|coworker|co worker|classmate|teacher|professor|neighbou?r|boss|friend|sister|brother|mom|mother|dad|father|aunt|cousin))\b/;

/**
 * Evaluate a prompt (and optional negative prompt) against the safety rules.
 */
export function checkPrompt(
  rawPrompt: string,
  opts?: { strictMinors?: boolean; negativePrompt?: string | null },
): ModerationVerdict {
  const strict = !!opts?.strictMinors;
  const combined = `${rawPrompt ?? ""} ${opts?.negativePrompt ?? ""}`;
  const text = norm(combined);
  const leet = norm(deleet(combined));

  // 1) CSAM — the highest-priority, no-exception block.
  if (UNAMBIGUOUS_MINOR.test(text) || UNAMBIGUOUS_MINOR.test(leet)) {
    return { allowed: false, category: "csam", userMessage: CSAM_MESSAGE };
  }
  const hasMinor =
    MINOR_WORDS.test(text) ||
    MINOR_WORDS.test(leet) ||
    AGE_UNDER_18.test(text) ||
    SPELLED_AGE_UNDER_18.test(text);
  const hasSexual = SEXUAL.test(text) || SEXUAL.test(leet);
  if (hasMinor && hasSexual) {
    return { allowed: false, category: "csam", userMessage: CSAM_MESSAGE };
  }
  // In the unfiltered (NSFW) path, any minor reference at all is refused.
  if (strict && hasMinor) {
    return { allowed: false, category: "minor", userMessage: MINOR_MESSAGE };
  }

  // 2) Non-consensual real-person sexual content.
  if (DEEPFAKE.test(text) || DEEPFAKE.test(leet)) {
    return { allowed: false, category: "deepfake", userMessage: DEEPFAKE_MESSAGE };
  }
  if (hasSexual && (REAL_PERSON.test(text) || GENERIC_REAL_PERSON.test(text))) {
    return { allowed: false, category: "deepfake", userMessage: DEEPFAKE_MESSAGE };
  }

  return { allowed: true };
}

export class PromptBlockedError extends Error {
  category: ModerationCategory;
  userMessage: string;
  constructor(verdict: Extract<ModerationVerdict, { allowed: false }>) {
    super(`prompt blocked: ${verdict.category}`);
    this.name = "PromptBlockedError";
    this.category = verdict.category;
    this.userMessage = verdict.userMessage;
  }
}

/**
 * Defense-in-depth assertion for use deep in the generation chain (e.g. inside
 * generateUnfiltered). Throws PromptBlockedError so any caller — present or
 * future — that reaches the no-safety chain is still protected even if a
 * higher-level gate was missed.
 */
export function assertPromptAllowed(
  prompt: string,
  opts?: { strictMinors?: boolean; negativePrompt?: string | null },
): void {
  const verdict = checkPrompt(prompt, opts);
  if (!verdict.allowed) throw new PromptBlockedError(verdict);
}

/**
 * Persistent audit trail for a refusal: console line (greppable in Vercel
 * logs) + a moderation_log DB row (the compliance record safe-harbor expects).
 * Prompt CONTENT is never stored — only length + SHA-256, so refusals can be
 * counted/correlated without retaining the text itself.
 *
 * Never throws — logging must not break the refusal. Callers MUST await it
 * (un-awaited promises die at Vercel lambda freeze and the row is lost).
 */
export async function logModerationBlock(entry: {
  category: ModerationCategory;
  promptLen: number;
  userId?: number | null;
  ip?: string | null;
  surface: string;
  /** Raw prompt — hashed (SHA-256) for the DB row, never stored verbatim. */
  prompt?: string;
}): Promise<void> {
  try {
    console.warn(
      "[moderation] BLOCK " +
        JSON.stringify({
          category: entry.category,
          surface: entry.surface,
          promptLen: entry.promptLen,
          userId: entry.userId ?? null,
          ip: entry.ip ?? null,
        }),
    );
  } catch {
    /* never throw from logging */
  }
  try {
    const { getDb } = await import("../db");
    const db = await getDb();
    if (!db) return;
    const { moderationLog } = await import("../../drizzle/schema");
    await db.insert(moderationLog).values({
      category: entry.category,
      surface: entry.surface,
      userId: entry.userId ?? null,
      ip: entry.ip ?? null,
      promptLen: entry.promptLen,
      promptSha256:
        typeof entry.prompt === "string"
          ? crypto.createHash("sha256").update(entry.prompt, "utf8").digest("hex")
          : null,
    });
  } catch (err) {
    // DB write is best-effort; the console line above is the fallback trail.
    try {
      console.warn("[moderation] moderation_log write failed:", err);
    } catch {
      /* never throw from logging */
    }
  }
}
