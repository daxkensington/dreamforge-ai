import { useRef, useState } from "react";
import {
  clearGenerationRequestIdentity,
  fingerprintGenerationInput,
  persistGenerationRequestIdentity,
  readGenerationRequestIdentity,
  resolveGenerationRequestIdentity,
  type GenerationRequestIdentity,
} from "@shared/workspaceModelSelection";

function scopedStorage(scope: string) {
  try {
    const storage = window.sessionStorage;
    return {
      getItem: (key: string) => storage.getItem(`${scope}:${key}`),
      setItem: (key: string, value: string) => storage.setItem(`${scope}:${key}`, value),
      removeItem: (key: string) => storage.removeItem(`${scope}:${key}`),
    };
  } catch { return undefined; }
}

/** Retain an uncertain logical submission without persisting its prompt. */
export function useGenerationRequestIdentity(userId: number | undefined, scope: string) {
  const identity = useRef<GenerationRequestIdentity | null>(null);
  const busy = useRef(false);
  const currentUser = useRef(userId);
  currentUser.current = userId;
  const [preparing, setPreparing] = useState(false);
  const [waiting, setWaiting] = useState(false);

  async function prepare<T extends Record<string, unknown>>(payload: T) {
    if (busy.current) return null;
    if (!Number.isSafeInteger(userId) || !userId || userId <= 0) throw new Error("Sign in to generate an image.");
    busy.current = true;
    setPreparing(true);
    try {
      const fingerprint = await fingerprintGenerationInput(payload);
      if (currentUser.current !== userId) throw new Error("Your account changed. Please start again.");
      const storage = scopedStorage(scope);
      const previous = identity.current?.userId === userId ? identity.current : readGenerationRequestIdentity(userId, storage);
      identity.current = resolveGenerationRequestIdentity(previous, userId, fingerprint);
      persistGenerationRequestIdentity(identity.current, storage);
      setWaiting(false);
      return { ...payload, requestId: identity.current.requestId };
    } catch (error) {
      busy.current = false;
      throw error;
    } finally {
      setPreparing(false);
    }
  }

  function receive(result: { status?: unknown; requestId?: unknown }) {
    if (result.requestId !== identity.current?.requestId) return;
    if (result.status === "completed" || result.status === "failed") {
      clearGenerationRequestIdentity(identity.current!, scopedStorage(scope));
      identity.current = null;
      setWaiting(false);
    } else {
      setWaiting(true);
    }
  }

  return {
    prepare, receive, preparing, waiting,
    uncertain: () => setWaiting(true),
    settled: () => { busy.current = false; },
  };
}
