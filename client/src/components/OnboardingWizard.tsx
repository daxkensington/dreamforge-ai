import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import {
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Wand2,
  Image,
  Video,
  Palette,
  Zap,
  X,
  Check,
  Rocket,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const ONBOARDING_KEY = "dreamforge_onboarding_completed";

export function useOnboarding() {
  const [completed, setCompleted] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return localStorage.getItem(ONBOARDING_KEY) === "true";
    } catch {
      return false;
    }
  });

  const markCompleted = useCallback(() => {
    try {
      localStorage.setItem(ONBOARDING_KEY, "true");
    } catch {}
    setCompleted(true);
  }, []);

  const resetOnboarding = useCallback(() => {
    try {
      localStorage.removeItem(ONBOARDING_KEY);
    } catch {}
    setCompleted(false);
  }, []);

  return { completed, markCompleted, resetOnboarding };
}

interface OnboardingWizardProps {
  onComplete: () => void;
  onDismiss: () => void;
}

const stylePresets = [
  { id: "fantasy", label: "Fantasy", emoji: "🐉", color: "from-violet-500 to-purple-400" },
  { id: "scifi", label: "Sci-Fi", emoji: "🚀", color: "from-cyan-500 to-blue-400" },
  { id: "nature", label: "Nature", emoji: "🌿", color: "from-emerald-500 to-green-400" },
  { id: "portrait", label: "Portrait", emoji: "👤", color: "from-amber-500 to-orange-400" },
  { id: "abstract", label: "Abstract", emoji: "🎨", color: "from-pink-500 to-rose-400" },
  { id: "anime", label: "Anime", emoji: "✨", color: "from-fuchsia-500 to-pink-400" },
];

const promptSuggestions: Record<string, string[]> = {
  fantasy: [
    "A majestic dragon perched on a crystal mountain at sunset, golden light, epic scale",
    "An enchanted forest with glowing mushrooms and floating lanterns, ethereal atmosphere",
    "A warrior princess standing before an ancient castle gate, dramatic lighting",
  ],
  scifi: [
    "A cyberpunk city at night with neon signs and flying cars, rain-soaked streets",
    "An astronaut floating above a ringed planet, stars reflecting in the visor",
    "A futuristic laboratory with holographic displays and robotic arms, blue lighting",
  ],
  nature: [
    "A serene mountain lake at sunrise with mist rolling over the water, golden hour",
    "A field of wildflowers stretching to the horizon under a dramatic sky",
    "An ancient redwood forest with sunbeams piercing through the canopy",
  ],
  portrait: [
    "A regal figure in ornate golden armor, studio lighting, dramatic shadows",
    "A mysterious traveler in a hooded cloak standing in falling rain, cinematic",
    "An elegant figure surrounded by floating butterflies, soft bokeh background",
  ],
  abstract: [
    "Flowing liquid metal in iridescent colors, macro photography, studio lighting",
    "Geometric fractals dissolving into particles of light, cosmic background",
    "Swirling paint in water creating organic patterns, vibrant colors, high contrast",
  ],
  anime: [
    "A magical girl with flowing hair casting a spell, cherry blossoms, cel shading",
    "A lone samurai standing on a cliff overlooking a vast ocean, sunset, anime style",
    "A cozy ramen shop on a rainy night, warm interior glow, Studio Ghibli inspired",
  ],
};

export default function OnboardingWizard({ onComplete, onDismiss }: OnboardingWizardProps) {
  const [step, setStep] = useState(0);
  const [selectedStyle, setSelectedStyle] = useState<string | null>(null);
  const [selectedPrompt, setSelectedPrompt] = useState<string | null>(null);
  const [, navigate] = useLocation();

  const totalSteps = 4;

  const handleFinish = () => {
    onComplete();
    navigate(`/workspace${selectedPrompt ? `?prompt=${encodeURIComponent(selectedPrompt)}` : ""}`);
  };

  const slideVariants = {
    enter: (direction: number) => ({ x: direction > 0 ? 200 : -200, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (direction: number) => ({ x: direction < 0 ? 200 : -200, opacity: 0 }),
  };

  const [direction, setDirection] = useState(0);

  const goNext = () => {
    setDirection(1);
    setStep((s) => Math.min(s + 1, totalSteps - 1));
  };

  const goBack = () => {
    setDirection(-1);
    setStep((s) => Math.max(s - 1, 0));
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-xl">
      <div className="relative w-full max-w-2xl mx-4">
        {/* Dismiss */}
        <button
          onClick={onDismiss}
          className="absolute -top-12 right-0 text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2 text-sm"
        >
          Skip intro
          <X className="h-4 w-4" />
        </button>

        <div className="rounded-2xl border border-border/50 bg-card shadow-2xl shadow-primary/5 overflow-hidden">
          {/* Progress bar */}
          <div className="h-1 bg-muted">
            <div
              className="h-full bg-gradient-to-r from-primary to-violet-400 transition-all duration-500"
              style={{ width: `${((step + 1) / totalSteps) * 100}%` }}
            />
          </div>

          <div className="p-8 md:p-10 min-h-[420px] flex flex-col">
            <AnimatePresence mode="wait" custom={direction}>
              <motion.div
                key={step}
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.3 }}
                className="flex-1 flex flex-col"
              >
                {/* Step 0: Welcome */}
                {step === 0 && (
                  <div className="flex-1 flex flex-col items-center justify-center text-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-violet-500 shadow-lg mb-6">
                      <Wand2 className="h-8 w-8 text-white" />
                    </div>
                    <h2 className="text-2xl md:text-3xl font-bold mb-3">
                      Welcome to DreamForge
                    </h2>
                    <p className="text-muted-foreground max-w-md mb-8">
                      Create stunning images, videos, and animations with AI. Let's get you started with your first creation in under 60 seconds.
                    </p>
                    <div className="flex items-center gap-6 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <Image className="h-4 w-4 text-primary" />
                        <span>Text to Image</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Video className="h-4 w-4 text-fuchsia-400" />
                        <span>Text to Video</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Palette className="h-4 w-4 text-amber-400" />
                        <span>AI Tools</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 1: Pick a Style */}
                {step === 1 && (
                  <div className="flex-1 flex flex-col">
                    <div className="text-center mb-6">
                      <h2 className="text-xl md:text-2xl font-bold mb-2">
                        What do you want to create?
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        Pick a style that inspires you. This helps us suggest the perfect prompt.
                      </p>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 flex-1">
                      {stylePresets.map((style) => (
                        <button
                          key={style.id}
                          onClick={() => {
                            setSelectedStyle(style.id);
                            setSelectedPrompt(null);
                          }}
                          className={`relative p-4 rounded-xl border text-center transition-all duration-200 hover:scale-[1.02] ${
                            selectedStyle === style.id
                              ? "border-primary bg-primary/10 ring-2 ring-primary/30"
                              : "border-border/50 bg-card/50 hover:border-border hover:bg-card"
                          }`}
                        >
                          {selectedStyle === style.id && (
                            <div className="absolute top-2 right-2">
                              <Check className="h-4 w-4 text-primary" />
                            </div>
                          )}
                          <span className="text-2xl mb-2 block">{style.emoji}</span>
                          <span className="text-sm font-medium">{style.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Step 2: Pick a Prompt */}
                {step === 2 && (
                  <div className="flex-1 flex flex-col">
                    <div className="text-center mb-6">
                      <h2 className="text-xl md:text-2xl font-bold mb-2">
                        Choose a prompt to start
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        Select one of these curated prompts, or write your own in the Studio.
                      </p>
                    </div>
                    <div className="space-y-3 flex-1">
                      {(promptSuggestions[selectedStyle || "fantasy"] || promptSuggestions.fantasy).map((prompt, i) => (
                        <button
                          key={i}
                          onClick={() => setSelectedPrompt(prompt)}
                          className={`w-full text-left p-4 rounded-xl border transition-all duration-200 ${
                            selectedPrompt === prompt
                              ? "border-primary bg-primary/10 ring-2 ring-primary/30"
                              : "border-border/50 bg-card/50 hover:border-border hover:bg-card"
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            {selectedPrompt === prompt ? (
                              <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary">
                                <Check className="h-3 w-3 text-white" />
                              </div>
                            ) : (
                              <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-border/50" />
                            )}
                            <p className="text-sm leading-relaxed">{prompt}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Step 3: Ready to Go */}
                {step === 3 && (
                  <div className="flex-1 flex flex-col items-center justify-center text-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-400 shadow-lg mb-6">
                      <Rocket className="h-8 w-8 text-white" />
                    </div>
                    <h2 className="text-2xl md:text-3xl font-bold mb-3">
                      You're All Set!
                    </h2>
                    <p className="text-muted-foreground max-w-md mb-6">
                      Your prompt is ready. Click the button below to open the Studio and generate your first creation.
                    </p>
                    {selectedPrompt && (
                      <div className="w-full max-w-md p-4 rounded-xl border border-primary/20 bg-primary/5 mb-6">
                        <p className="text-xs text-primary font-medium mb-1">Your prompt:</p>
                        <p className="text-sm leading-relaxed">{selectedPrompt}</p>
                      </div>
                    )}
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <Zap className="h-3.5 w-3.5 text-amber-400" />
                        <span>Generates in ~10 seconds</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Sparkles className="h-3.5 w-3.5 text-primary" />
                        <span>25 free generations</span>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>

            {/* Navigation */}
            <div className="flex items-center justify-between mt-6 pt-6 border-t border-border/30">
              <div className="flex items-center gap-2">
                {Array.from({ length: totalSteps }).map((_, i) => (
                  <div
                    key={i}
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      i === step ? "w-6 bg-primary" : i < step ? "w-1.5 bg-primary/50" : "w-1.5 bg-muted"
                    }`}
                  />
                ))}
              </div>

              <div className="flex items-center gap-3">
                {step > 0 && (
                  <Button variant="outline" size="sm" onClick={goBack} className="gap-1.5 bg-transparent">
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Back
                  </Button>
                )}
                {step < totalSteps - 1 ? (
                  <Button
                    size="sm"
                    onClick={goNext}
                    className="gap-1.5"
                    disabled={step === 1 && !selectedStyle}
                  >
                    {step === 0 ? "Let's Go" : "Next"}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    onClick={handleFinish}
                    className="gap-1.5 bg-gradient-to-r from-primary to-violet-500 hover:from-primary/90 hover:to-violet-500/90"
                  >
                    Open Studio
                    <Sparkles className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
