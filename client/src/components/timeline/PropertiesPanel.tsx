import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sparkles, Gauge, Eye, Palette, Music, Volume2,
  Type, AlignCenter, AlignLeft, AlignRight, Bold, Italic,
  ArrowUpDown, Clock, Wand2, X, Film, Layers,
} from "lucide-react";
import type { Clip, Track } from "@/hooks/useTimeline";

interface PropertiesPanelProps {
  clip: Clip | null;
  track: Track | null;
  onUpdateClip: (id: string, updates: Partial<Clip>) => void;
  onClose: () => void;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
      {children}
    </h3>
  );
}

function PropertyRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 mb-2">
      <span className="text-xs text-muted-foreground shrink-0">{label}</span>
      <div className="flex-1 max-w-[160px]">{children}</div>
    </div>
  );
}

function VideoProperties({ clip, onUpdate }: { clip: Clip; onUpdate: (u: Partial<Clip>) => void }) {
  const style = (clip.style ?? {}) as Record<string, number | string>;
  const speed = (style.speed as number) ?? 1;
  const opacity = (style.opacity as number) ?? 100;
  const filter = (style.filter as string) ?? "none";

  return (
    <div className="space-y-4">
      <div>
        <SectionLabel>Playback</SectionLabel>
        <PropertyRow label="Speed">
          <div className="flex items-center gap-2">
            <Slider
              value={[speed * 100]}
              onValueChange={([v]) => onUpdate({ style: { ...style, speed: v / 100 } })}
              min={25}
              max={400}
              step={25}
            />
            <span className="text-[10px] text-muted-foreground w-8 text-right">{speed}x</span>
          </div>
        </PropertyRow>
        <PropertyRow label="Opacity">
          <div className="flex items-center gap-2">
            <Slider
              value={[opacity]}
              onValueChange={([v]) => onUpdate({ style: { ...style, opacity: v } })}
              min={0}
              max={100}
              step={1}
            />
            <span className="text-[10px] text-muted-foreground w-8 text-right">{opacity}%</span>
          </div>
        </PropertyRow>
      </div>

      <div>
        <SectionLabel>Filters</SectionLabel>
        <Select value={filter} onValueChange={(v) => onUpdate({ style: { ...style, filter: v } })}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None</SelectItem>
            <SelectItem value="grayscale">Grayscale</SelectItem>
            <SelectItem value="sepia">Sepia</SelectItem>
            <SelectItem value="vintage">Vintage</SelectItem>
            <SelectItem value="cinematic">Cinematic</SelectItem>
            <SelectItem value="cool">Cool Tone</SelectItem>
            <SelectItem value="warm">Warm Tone</SelectItem>
            <SelectItem value="high-contrast">High Contrast</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Button variant="outline" size="sm" className="w-full gap-2 h-8 text-xs">
          <Sparkles className="h-3.5 w-3.5" />
          Regenerate with AI
        </Button>
      </div>
    </div>
  );
}

function AudioProperties({ clip, onUpdate }: { clip: Clip; onUpdate: (u: Partial<Clip>) => void }) {
  const style = (clip.style ?? {}) as Record<string, number>;
  const volume = (style.volume as number) ?? 100;
  const fadeIn = (style.fadeIn as number) ?? 0;
  const fadeOut = (style.fadeOut as number) ?? 0;

  return (
    <div className="space-y-4">
      <div>
        <SectionLabel>Audio</SectionLabel>
        <PropertyRow label="Volume">
          <div className="flex items-center gap-2">
            <Slider
              value={[volume]}
              onValueChange={([v]) => onUpdate({ style: { ...style, volume: v } })}
              min={0}
              max={200}
              step={1}
            />
            <span className="text-[10px] text-muted-foreground w-8 text-right">{volume}%</span>
          </div>
        </PropertyRow>
        <PropertyRow label="Fade In">
          <div className="flex items-center gap-2">
            <Slider
              value={[fadeIn]}
              onValueChange={([v]) => onUpdate({ style: { ...style, fadeIn: v } })}
              min={0}
              max={5}
              step={0.1}
            />
            <span className="text-[10px] text-muted-foreground w-8 text-right">{fadeIn}s</span>
          </div>
        </PropertyRow>
        <PropertyRow label="Fade Out">
          <div className="flex items-center gap-2">
            <Slider
              value={[fadeOut]}
              onValueChange={([v]) => onUpdate({ style: { ...style, fadeOut: v } })}
              min={0}
              max={5}
              step={0.1}
            />
            <span className="text-[10px] text-muted-foreground w-8 text-right">{fadeOut}s</span>
          </div>
        </PropertyRow>
      </div>

      <div>
        <Button variant="outline" size="sm" className="w-full gap-2 h-8 text-xs">
          <Music className="h-3.5 w-3.5" />
          Generate New Audio
        </Button>
      </div>
    </div>
  );
}

function TextProperties({ clip, onUpdate }: { clip: Clip; onUpdate: (u: Partial<Clip>) => void }) {
  const style = (clip.style ?? {}) as Record<string, string | number>;
  const fontSize = (style.fontSize as number) ?? 32;
  const fontFamily = (style.fontFamily as string) ?? "Inter";
  const color = (style.color as string) ?? "#ffffff";
  const textAlign = (style.textAlign as string) ?? "center";
  const animation = (style.animation as string) ?? "none";

  return (
    <div className="space-y-4">
      <div>
        <SectionLabel>Text Content</SectionLabel>
        <Input
          value={clip.text ?? ""}
          onChange={(e) => onUpdate({ text: e.target.value })}
          className="h-8 text-xs mb-2"
          placeholder="Enter text..."
        />
      </div>

      <div>
        <SectionLabel>Typography</SectionLabel>
        <PropertyRow label="Font">
          <Select value={fontFamily} onValueChange={(v) => onUpdate({ style: { ...style, fontFamily: v } })}>
            <SelectTrigger className="h-7 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Inter">Inter</SelectItem>
              <SelectItem value="Roboto">Roboto</SelectItem>
              <SelectItem value="Playfair Display">Playfair</SelectItem>
              <SelectItem value="Montserrat">Montserrat</SelectItem>
              <SelectItem value="Source Code Pro">Monospace</SelectItem>
            </SelectContent>
          </Select>
        </PropertyRow>
        <PropertyRow label="Size">
          <div className="flex items-center gap-2">
            <Slider
              value={[fontSize]}
              onValueChange={([v]) => onUpdate({ style: { ...style, fontSize: v } })}
              min={8}
              max={128}
              step={1}
            />
            <span className="text-[10px] text-muted-foreground w-8 text-right">{fontSize}px</span>
          </div>
        </PropertyRow>
        <PropertyRow label="Color">
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={color}
              onChange={(e) => onUpdate({ style: { ...style, color: e.target.value } })}
              className="h-6 w-6 rounded border border-border/50 cursor-pointer bg-transparent"
            />
            <span className="text-[10px] text-muted-foreground font-mono">{color}</span>
          </div>
        </PropertyRow>
        <PropertyRow label="Align">
          <div className="flex gap-0.5">
            {[
              { value: "left", icon: AlignLeft },
              { value: "center", icon: AlignCenter },
              { value: "right", icon: AlignRight },
            ].map(({ value, icon: AlignIcon }) => (
              <button
                key={value}
                onClick={() => onUpdate({ style: { ...style, textAlign: value } })}
                className={`h-7 w-7 flex items-center justify-center rounded transition-colors
                  ${textAlign === value ? "bg-white/10 text-foreground" : "text-muted-foreground hover:bg-white/5"}`}
              >
                <AlignIcon className="h-3.5 w-3.5" />
              </button>
            ))}
          </div>
        </PropertyRow>
      </div>

      <div>
        <SectionLabel>Animation</SectionLabel>
        <Select value={animation} onValueChange={(v) => onUpdate({ style: { ...style, animation: v } })}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None</SelectItem>
            <SelectItem value="fade-in">Fade In</SelectItem>
            <SelectItem value="slide-up">Slide Up</SelectItem>
            <SelectItem value="slide-down">Slide Down</SelectItem>
            <SelectItem value="typewriter">Typewriter</SelectItem>
            <SelectItem value="bounce">Bounce</SelectItem>
            <SelectItem value="scale">Scale</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

function TransitionProperties({ clip, onUpdate }: { clip: Clip; onUpdate: (u: Partial<Clip>) => void }) {
  const style = (clip.style ?? {}) as Record<string, string | number>;
  const transitionType = (style.transitionType as string) ?? "fade";
  const transitionDuration = (style.transitionDuration as number) ?? 1;

  return (
    <div className="space-y-4">
      <div>
        <SectionLabel>Transition</SectionLabel>
        <PropertyRow label="Type">
          <Select value={transitionType} onValueChange={(v) => onUpdate({ style: { ...style, transitionType: v } })}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="fade">Fade</SelectItem>
              <SelectItem value="dissolve">Dissolve</SelectItem>
              <SelectItem value="wipe-left">Wipe Left</SelectItem>
              <SelectItem value="wipe-right">Wipe Right</SelectItem>
              <SelectItem value="wipe-up">Wipe Up</SelectItem>
              <SelectItem value="zoom">Zoom</SelectItem>
              <SelectItem value="slide">Slide</SelectItem>
            </SelectContent>
          </Select>
        </PropertyRow>
        <PropertyRow label="Duration">
          <div className="flex items-center gap-2">
            <Slider
              value={[transitionDuration * 10]}
              onValueChange={([v]) => onUpdate({ style: { ...style, transitionDuration: v / 10 } })}
              min={1}
              max={30}
              step={1}
            />
            <span className="text-[10px] text-muted-foreground w-8 text-right">{transitionDuration}s</span>
          </div>
        </PropertyRow>
      </div>
    </div>
  );
}

export default function PropertiesPanel({ clip, track, onUpdateClip, onClose }: PropertiesPanelProps) {
  const typeIcons: Record<string, React.ElementType> = {
    video: Film,
    audio: Music,
    text: Type,
    transition: Layers,
  };

  return (
    <div className="h-full flex flex-col border-l border-border/30 bg-background/60">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/30">
        <div className="flex items-center gap-2">
          <Wand2 className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-medium">Properties</span>
        </div>
        {clip && (
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          {clip ? (
            <motion.div
              key={clip.id}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.15 }}
              className="p-3 space-y-4"
            >
              {/* Clip info */}
              <div className="flex items-center gap-2 p-2 bg-white/[0.03] rounded-md">
                {(() => {
                  const Icon = typeIcons[clip.type] ?? Film;
                  return <Icon className="h-4 w-4 text-muted-foreground shrink-0" />;
                })()}
                <div className="min-w-0">
                  <p className="text-xs font-medium truncate">{clip.name || clip.text || clip.type}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {clip.startTime.toFixed(1)}s - {(clip.startTime + clip.duration).toFixed(1)}s
                    <span className="mx-1">|</span>
                    {clip.duration.toFixed(1)}s
                  </p>
                </div>
              </div>

              {/* General properties */}
              <div>
                <SectionLabel>General</SectionLabel>
                <PropertyRow label="Name">
                  <Input
                    value={clip.name ?? ""}
                    onChange={(e) => onUpdateClip(clip.id, { name: e.target.value })}
                    className="h-7 text-xs"
                    placeholder="Clip name"
                  />
                </PropertyRow>
                <PropertyRow label="Start">
                  <Input
                    type="number"
                    value={clip.startTime.toFixed(2)}
                    onChange={(e) => onUpdateClip(clip.id, { startTime: parseFloat(e.target.value) || 0 })}
                    className="h-7 text-xs font-mono"
                    step={0.1}
                    min={0}
                  />
                </PropertyRow>
                <PropertyRow label="Duration">
                  <Input
                    type="number"
                    value={clip.duration.toFixed(2)}
                    onChange={(e) => onUpdateClip(clip.id, { duration: Math.max(0.1, parseFloat(e.target.value) || 0.1) })}
                    className="h-7 text-xs font-mono"
                    step={0.1}
                    min={0.1}
                  />
                </PropertyRow>
              </div>

              {/* Type-specific properties */}
              {clip.type === "video" && (
                <VideoProperties clip={clip} onUpdate={(u) => onUpdateClip(clip.id, u)} />
              )}
              {clip.type === "audio" && (
                <AudioProperties clip={clip} onUpdate={(u) => onUpdateClip(clip.id, u)} />
              )}
              {clip.type === "text" && (
                <TextProperties clip={clip} onUpdate={(u) => onUpdateClip(clip.id, u)} />
              )}
              {clip.type === "transition" && (
                <TransitionProperties clip={clip} onUpdate={(u) => onUpdateClip(clip.id, u)} />
              )}
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center h-full text-center p-6"
            >
              <Wand2 className="h-8 w-8 text-muted-foreground/30 mb-3" />
              <p className="text-xs text-muted-foreground">
                Select a clip to edit its properties
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
