import { useEffect, useCallback } from "react";

type ShortcutHandler = () => void;

interface Shortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  handler: ShortcutHandler;
  description: string;
  scope?: string;
}

const globalShortcuts: Shortcut[] = [];

export function useKeyboardShortcuts(shortcuts: Shortcut[]) {
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Don't trigger shortcuts when typing in inputs
    const target = e.target as HTMLElement;
    if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) {
      // Only allow Escape in inputs
      if (e.key !== "Escape") return;
    }

    for (const shortcut of shortcuts) {
      const ctrlMatch = shortcut.ctrl ? (e.ctrlKey || e.metaKey) : !(e.ctrlKey || e.metaKey);
      const shiftMatch = shortcut.shift ? e.shiftKey : !e.shiftKey;
      const altMatch = shortcut.alt ? e.altKey : !e.altKey;

      if (e.key.toLowerCase() === shortcut.key.toLowerCase() && ctrlMatch && shiftMatch && altMatch) {
        e.preventDefault();
        shortcut.handler();
        return;
      }
    }
  }, [shortcuts]);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);
}

export function useGlobalShortcuts() {
  useKeyboardShortcuts([
    { key: "?", shift: true, handler: () => {
      document.dispatchEvent(new CustomEvent("toggle-shortcuts-modal"));
    }, description: "Show keyboard shortcuts", scope: "Global" },
  ]);
}

export const SHORTCUT_REFERENCE = [
  { scope: "Global", shortcuts: [
    { keys: "Shift + ?", description: "Show keyboard shortcuts" },
    { keys: "Escape", description: "Close dialog / Cancel" },
  ]},
  { scope: "Workspace", shortcuts: [
    { keys: "Ctrl + Enter", description: "Generate image" },
    { keys: "Ctrl + S", description: "Save to gallery" },
    { keys: "Ctrl + Z", description: "Undo last change" },
  ]},
  { scope: "Gallery", shortcuts: [
    { keys: "L", description: "Like / Unlike" },
    { keys: "C", description: "Open comments" },
    { keys: "Arrow Left / Right", description: "Navigate items" },
  ]},
  { scope: "Video Studio", shortcuts: [
    { keys: "Ctrl + Enter", description: "Generate storyboard" },
    { keys: "Ctrl + S", description: "Save project" },
    { keys: "Ctrl + E", description: "Export PDF" },
  ]},
];
