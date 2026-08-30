"use client";

import { useState } from "react";
import UncensoredImageStudio from "./UncensoredImageStudio";
import UncensoredRefineStudio from "./UncensoredRefineStudio";
import UncensoredInpaintStudio from "./UncensoredInpaintStudio";
import UncensoredVideoStudio from "./UncensoredVideoStudio";
import UncensoredLibrary from "./UncensoredLibrary";

type Tab = "create" | "refine" | "inpaint" | "video" | "library";

const TABS: { id: Tab; label: string }[] = [
  { id: "create", label: "Create" },
  { id: "refine", label: "Refine" },
  { id: "inpaint", label: "Inpaint" },
  { id: "video", label: "Video" },
  { id: "library", label: "Library" },
];

/**
 * Paid uncensored workspace. Tabs share a focused generation id so Create →
 * Refine / Inpaint / Animate is one click instead of re-picking the image.
 */
export default function UncensoredStudio({ until }: { until: Date | string | null }) {
  const [tab, setTab] = useState<Tab>("create");
  const [focusId, setFocusId] = useState<number | null>(null);
  const [recreateId, setRecreateId] = useState<number | null>(null);

  const go = (next: Tab, id?: number) => {
    if (typeof id === "number") setFocusId(id);
    setTab(next);
  };

  return (
    <div className="mt-12 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-6 sm:p-8">
      <div className="text-center">
        <h2 className="text-2xl font-semibold">Uncensored studio</h2>
        <p className="mt-2 text-muted-foreground">
          Active until {until ? new Date(until).toLocaleDateString() : "—"}. Private, unfiltered, no watermark.
        </p>
      </div>
      <div className="mt-6 flex flex-wrap justify-center gap-1 rounded-lg border border-border/60 p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-md px-3 py-1.5 text-sm ${
              tab === t.id ? "bg-rose-500/20 text-rose-200" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="text-left">
        {tab === "create" && (
          <UncensoredImageStudio
            focusCharacterId={focusId}
            recreateId={recreateId}
            onRefine={(id) => go("refine", id)}
            onInpaint={(id) => go("inpaint", id)}
            onAnimate={(id) => go("video", id)}
          />
        )}
        {tab === "refine" && <UncensoredRefineStudio focusGenerationId={focusId} />}
        {tab === "inpaint" && <UncensoredInpaintStudio focusGenerationId={focusId} />}
        {tab === "video" && <UncensoredVideoStudio focusGenerationId={focusId} />}
        {tab === "library" && (
          <UncensoredLibrary
            onRefine={(id) => go("refine", id)}
            onInpaint={(id) => go("inpaint", id)}
            onAnimate={(id) => go("video", id)}
            onUseCharacter={(id) => {
              setRecreateId(null);
              go("create", id);
            }}
            onRecreate={(id) => {
              setFocusId(null);
              setRecreateId(id);
              setTab("create");
            }}
          />
        )}
      </div>
    </div>
  );
}
