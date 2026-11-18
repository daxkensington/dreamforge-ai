"use client";

import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { ArrowRight, Download, Loader2, Wand2 } from "lucide-react";
import PageLayout from "@/components/PageLayout";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { buildAdultRedirectUrl, isAdultRedirect } from "@shared/adultRouting";
import { getLoginUrl } from "@/const";
import { track } from "@/lib/analytics";
import styles from "./DemoTextToImage.module.css";

declare global {
  interface Window {
    fbq?: (
      event: string,
      name: string,
      params?: Record<string, unknown>
    ) => void;
  }
}

/**
 * Meta custom conversion for demo activations, so paid campaigns can
 * optimize on "person actually got a generation out of the demo", not just
 * clicks. Guarded like the pixel code in app/MetaPixelConversions.tsx: the
 * pixel may be blocked or absent, and that must never break the demo.
 * Called from the mutation's onSuccess — i.e. once per completed demo
 * generation, never per render.
 */
function trackDemoActivation(): void {
  try {
    if (typeof window !== "undefined" && typeof window.fbq === "function") {
      window.fbq("trackCustom", "DemoGenerationCompleted", {
        content_type: "demo",
      });
    }
  } catch {
    /* measurement failure must never surface to the visitor */
  }
}

const PROMPT_LIMIT = 500;
const EXAMPLES = [
  {
    label: "Neon street",
    prompt:
      "A quiet Tokyo side street in heavy rain, neon reflections, cinematic photography",
  },
  {
    label: "Wildlife portrait",
    prompt:
      "A snow leopard on a rocky ledge at dawn, soft light, detailed wildlife portrait",
  },
  {
    label: "Floating city",
    prompt:
      "A futuristic city floating above the clouds, dramatic golden hour, wide angle",
  },
  {
    label: "Enchanted library",
    prompt:
      "A magical library inside a hollow tree, glowing books, warm light, fantasy illustration",
  },
];

interface DemoResult {
  url: string;
  prompt: string;
}

export default function DemoTextToImage() {
  const { isAuthenticated } = useAuth();
  const [prompt, setPrompt] = useState("");
  const [result, setResult] = useState<DemoResult | null>(null);
  const [error, setError] = useState("");
  const autoRan = useRef(false);
  const promptInput = useRef<HTMLTextAreaElement>(null);

  function showFailure(message: string, submittedPrompt: string) {
    if (isAdultRedirect(message)) {
      toast.info("That one needs Uncensored mode — taking you there…");
      window.location.href = buildAdultRedirectUrl(submittedPrompt);
      return;
    }
    setError(message || "Generation failed. Please try again.");
  }

  const { mutate, isPending } = trpc.demo.generate.useMutation({
    onSuccess: (data, submitted) => {
      if (data.status === "completed" && data.url) {
        setResult({ url: data.url, prompt: data.prompt ?? submitted.prompt });
        track("generation_completed", { kind: "demo" });
        trackDemoActivation();
        return;
      }
      showFailure(("error" in data && data.error) || "", submitted.prompt);
    },
    onError: (err, submitted) => showFailure(err.message, submitted.prompt),
  });

  // A submission from the homepage carries the prompt and starts once here.
  useEffect(() => {
    if (autoRan.current) return;
    autoRan.current = true;
    const incoming = new URLSearchParams(window.location.search).get("prompt");
    const trimmed = (incoming ?? "").trim().slice(0, PROMPT_LIMIT);
    if (trimmed.length < 3) return;

    setPrompt(trimmed);
    track("generation_started", { kind: "demo", source: "autogen" });
    mutate({ prompt: trimmed });
  }, [mutate]);

  function handleGenerate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = prompt.trim();
    if (isPending || trimmed.length < 3) return;
    setError("");
    track("generation_started", { kind: "demo" });
    mutate({ prompt: trimmed });
  }

  const workspacePath = result
    ? `/workspace?${new URLSearchParams({ prompt: result.prompt })}`
    : "/workspace";
  const workspaceHref = isAuthenticated
    ? workspacePath
    : getLoginUrl(workspacePath);

  return (
    <PageLayout>
      <div className={styles.page}>
        <div className={styles.container}>
          <header className={styles.intro}>
            <p className={styles.eyebrow}>DreamForgeX Image Studio</p>
            <h1>
              Try AI Image Generation <em>Free</em>
            </h1>
            <p>
              Describe an image or start with an example. No account required.
            </p>
          </header>

          <div className={styles.studio}>
            <form onSubmit={handleGenerate} className={styles.composer}>
              <div className={styles.promptHeader}>
                <label htmlFor="demo-prompt">Describe an image</label>
                <span aria-hidden="true">
                  {prompt.length}/{PROMPT_LIMIT}
                </span>
              </div>
              <textarea
                ref={promptInput}
                id="demo-prompt"
                className={styles.prompt}
                value={prompt}
                onChange={event => setPrompt(event.target.value)}
                placeholder="A glass greenhouse on a rainy mountainside, warm light, wide angle…"
                rows={5}
                maxLength={PROMPT_LIMIT}
                disabled={isPending}
              />
              <div
                className={styles.examples}
                role="group"
                aria-labelledby="demo-examples"
              >
                <p id="demo-examples">Example prompts</p>
                {EXAMPLES.map(example => (
                  <button
                    key={example.label}
                    type="button"
                    disabled={isPending}
                    onClick={() => {
                      setPrompt(example.prompt);
                      setError("");
                      promptInput.current?.focus();
                    }}
                  >
                    {example.label}
                  </button>
                ))}
              </div>
              <div className={styles.controls}>
                <button
                  type="submit"
                  className={styles.primary}
                  disabled={isPending || prompt.trim().length < 3}
                >
                  {isPending ? (
                    <>
                      <Loader2 size={18} aria-hidden="true" /> Generating…
                    </>
                  ) : (
                    <>
                      <Wand2 size={18} aria-hidden="true" /> Generate (free)
                    </>
                  )}
                </button>
                <p className={styles.quota}>
                  One free image every 24 hours per IP address.
                </p>
              </div>
              {error && (
                <p role="alert" className={styles.error}>
                  {error}
                </p>
              )}
            </form>

            <section className={styles.output} aria-labelledby="demo-result">
              <div className={styles.outputHeader}>
                <h2 id="demo-result">Image preview</h2>
                <span className={styles.status} role="status">
                  {isPending
                    ? "Generating…"
                    : result
                      ? "Image ready"
                      : "No image yet"}
                </span>
              </div>
              <div className={styles.stage} aria-busy={isPending}>
                {isPending ? (
                  <div className={styles.loading}>
                    <Loader2 size={32} aria-hidden="true" />
                    <p>Creating your image</p>
                  </div>
                ) : result ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    className={styles.resultImage}
                    src={result.url}
                    alt={result.prompt}
                  />
                ) : (
                  <figure className={styles.placeholder}>
                    <img
                      src="/showcase/forge-image.webp"
                      alt="A chrome figure in dramatic studio lighting"
                    />
                    <figcaption>Sample image</figcaption>
                  </figure>
                )}
              </div>
              {result && !isPending && (
                <div className={styles.resultActions}>
                  <div className={styles.resultLinks}>
                    <a
                      className={styles.secondary}
                      href={result.url}
                      download="dreamforgex-demo.png"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Download size={17} aria-hidden="true" /> Download image
                    </a>
                    <a className={styles.primary} href={workspaceHref}>
                      Continue in Workspace{" "}
                      <ArrowRight size={17} aria-hidden="true" />
                    </a>
                  </div>
                  <p>
                    {isAuthenticated
                      ? "Your prompt carries over."
                      : "Sign in to carry your prompt into Workspace."}
                  </p>
                </div>
              )}
            </section>
          </div>

          <nav className={styles.footer} aria-label="More ways to create">
            <a href="/tools">Browse AI tools</a>
            <a href="/uncensored">Uncensored mode (18+)</a>
          </nav>
        </div>
      </div>
    </PageLayout>
  );
}
