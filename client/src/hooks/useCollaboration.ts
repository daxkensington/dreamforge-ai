/**
 * React hook for managing real-time WebSocket collaboration.
 *
 * Provides: presence data, cursor broadcasting, chat, clip edit broadcasting,
 * soft-lock management, and automatic reconnection with exponential backoff.
 */

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useAuth } from "@/_core/hooks/useAuth";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface WSMessage {
  type: string;
  projectId: string;
  userId: number;
  payload: any;
  timestamp: number;
}

export interface PresenceUser {
  user: { id: number; name: string | null; email: string | null };
  color: string;
  cursor: { x: number; y: number } | null;
  editingClipId: string | null;
  lastActivity: number;
  status: "active" | "idle" | "away";
  locks: string[];
}

export interface ChatMessage {
  id?: number;
  message: string;
  type: "text" | "system" | "action";
  userName: string | null;
  userId: number;
  color?: string;
  createdAt: string;
}

interface CollaborationState {
  connected: boolean;
  presence: PresenceUser[];
  chatMessages: ChatMessage[];
  clipLocks: Record<string, number>; // clipId -> userId
  conflicts: Array<{ clipId: string; lockedByName: string; timestamp: number }>;
}

// ─── Hook ───────────────────────────────────────────────────────────────────

export function useCollaboration(projectId: string | null) {
  const { user } = useAuth();
  const sessionKey = JSON.stringify([user?.id ?? null, projectId]);
  const sessionKeyRef = useRef(sessionKey);
  sessionKeyRef.current = sessionKey;
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  const [state, setState] = useState<CollaborationState>({
    connected: false,
    presence: [],
    chatMessages: [],
    clipLocks: {},
    conflicts: [],
  });

  const resetCollaborationState = useCallback(() => {
    setState({
      connected: false,
      presence: [],
      chatMessages: [],
      clipLocks: {},
      conflicts: [],
    });
    reconnectAttemptRef.current = 0;
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  // ─── WebSocket URL ──────────────────────────────────────────────

  const wsUrl = useMemo(() => {
    if (typeof window === "undefined") return null;
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${protocol}//${window.location.host}/ws`;
  }, []);

  // ─── Send helper ────────────────────────────────────────────────

  const send = useCallback((msg: Partial<WSMessage>) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN || !projectId || !user) return;
    ws.send(JSON.stringify({
      ...msg,
      projectId,
      userId: user.id,
      timestamp: Date.now(),
    }));
  }, [projectId, user]);

  // ─── Message handler ───────────────────────────────────────────

  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const msg: WSMessage = JSON.parse(event.data);
      if (!mountedRef.current) return;

      switch (msg.type) {
        case "presence":
          setState((s) => ({ ...s, presence: msg.payload as PresenceUser[] }));
          break;

        case "join":
          // Presence will be updated via a subsequent presence broadcast
          break;

        case "leave":
          setState((s) => ({
            ...s,
            presence: s.presence.filter((p) => p.user.id !== msg.userId),
          }));
          break;

        case "cursor":
          setState((s) => ({
            ...s,
            presence: s.presence.map((p) =>
              p.user.id === msg.userId
                ? { ...p, cursor: { x: msg.payload.x, y: msg.payload.y } }
                : p
            ),
          }));
          break;

        case "chat":
          setState((s) => ({
            ...s,
            chatMessages: [...s.chatMessages, msg.payload as ChatMessage].slice(-200),
          }));
          break;

        case "lock":
          setState((s) => ({
            ...s,
            clipLocks: { ...s.clipLocks, [msg.payload.clipId]: msg.userId },
          }));
          break;

        case "unlock":
          setState((s) => {
            const locks = { ...s.clipLocks };
            delete locks[msg.payload.clipId];
            return { ...s, clipLocks: locks };
          });
          break;

        case "conflict":
          setState((s) => ({
            ...s,
            conflicts: [
              ...s.conflicts,
              {
                clipId: msg.payload.clipId,
                lockedByName: msg.payload.lockedByName,
                timestamp: msg.timestamp,
              },
            ].slice(-10),
          }));
          break;

        case "sync_response":
          setState((s) => ({
            ...s,
            clipLocks: msg.payload.locks || {},
            presence: msg.payload.presence || s.presence,
          }));
          break;

        case "clip_update":
        case "clip_add":
        case "clip_delete":
          // These are forwarded to whoever is listening for project data changes
          // Emit a custom event that the video studio can listen to
          window.dispatchEvent(
            new CustomEvent("collab:clip_change", { detail: msg })
          );
          break;
      }
    } catch {
      // ignore parse errors
    }
  }, []);

  // ─── Connect / Reconnect ───────────────────────────────────────

  const connect = useCallback(() => {
    if (!mountedRef.current || sessionKeyRef.current !== sessionKey) return;
    if (!wsUrl || !projectId || !user) return;

    // Cancel any pending reconnect before replacing the socket
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }

    // Clean up existing. Detach first so its onclose sees a stale socket and is ignored.
    if (wsRef.current) {
      const oldWs = wsRef.current;
      wsRef.current = null;
      oldWs.close(1000, "Reconnecting");
    }

    // The stale socket's onclose is ignored, so reset the flag for the new socket here
    setState((s) => (s.connected ? { ...s, connected: false } : s));

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      if (!mountedRef.current || sessionKeyRef.current !== sessionKey) return;
      if (wsRef.current !== ws) return;
      reconnectAttemptRef.current = 0;
      setState((s) => ({ ...s, connected: true }));

      // Join the project room
      ws.send(JSON.stringify({
        type: "join",
        projectId,
        userId: user.id,
        payload: {},
        timestamp: Date.now(),
      }));
    };

    ws.onmessage = (event) => {
      if (!mountedRef.current || sessionKeyRef.current !== sessionKey) return;
      if (wsRef.current !== ws) return;
      handleMessage(event);
    };

    ws.onclose = (event) => {
      if (!mountedRef.current || sessionKeyRef.current !== sessionKey) return;
      if (wsRef.current !== ws) return;
      setState((s) => ({ ...s, connected: false }));

      // Don't reconnect on normal close, intentional close or auth failure
      if (event.code === 1000 || event.code === 4001 || event.code === 4003) return;

      // Exponential backoff: 1s, 2s, 4s, 8s, 16s, max 30s
      const delay = Math.min(1000 * Math.pow(2, reconnectAttemptRef.current), 30000);
      reconnectAttemptRef.current++;

      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }

      reconnectTimerRef.current = setTimeout(() => {
        if (!mountedRef.current || sessionKeyRef.current !== sessionKey) return;
        if (wsRef.current !== ws) return;
        reconnectTimerRef.current = null;
        connect();
      }, delay);
    };

    ws.onerror = () => {
      // onclose will handle reconnection
    };
  }, [wsUrl, projectId, user, handleMessage, sessionKey]);

  // ─── Lifecycle ─────────────────────────────────────────────────

  useEffect(() => {
    resetCollaborationState();
  }, [sessionKey, resetCollaborationState]);

  useEffect(() => {
    mountedRef.current = true;
    connect();

    return () => {
      mountedRef.current = false;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (wsRef.current) {
        const ws = wsRef.current;
        wsRef.current = null;
        ws.close(1000, "Component unmounted");
      }
    };
  }, [connect]);

  // ─── Public API ────────────────────────────────────────────────

  const sendCursorPosition = useCallback(
    (x: number, y: number) => {
      send({ type: "cursor", payload: { x, y } });
    },
    [send]
  );

  const sendChatMessage = useCallback(
    (message: string) => {
      send({ type: "chat", payload: { message, type: "text" } });
    },
    [send]
  );

  const lockClip = useCallback(
    (clipId: string) => {
      send({ type: "lock", payload: { clipId } });
    },
    [send]
  );

  const unlockClip = useCallback(
    (clipId: string) => {
      send({ type: "unlock", payload: { clipId } });
    },
    [send]
  );

  const broadcastClipUpdate = useCallback(
    (clipId: string, data: unknown) => {
      send({ type: "clip_update", payload: { clipId, data } });
    },
    [send]
  );

  const broadcastClipAdd = useCallback(
    (clipId: string, data: unknown) => {
      send({ type: "clip_add", payload: { clipId, data } });
    },
    [send]
  );

  const broadcastClipDelete = useCallback(
    (clipId: string) => {
      send({ type: "clip_delete", payload: { clipId } });
    },
    [send]
  );

  const requestSync = useCallback(() => {
    send({ type: "sync_request", payload: {} });
  }, [send]);

  const dismissConflict = useCallback((clipId: string) => {
    setState((s) => ({
      ...s,
      conflicts: s.conflicts.filter((c) => c.clipId !== clipId),
    }));
  }, []);

  return {
    connected: state.connected,
    presence: state.presence,
    chatMessages: state.chatMessages,
    clipLocks: state.clipLocks,
    conflicts: state.conflicts,
    sendCursorPosition,
    sendChatMessage,
    lockClip,
    unlockClip,
    broadcastClipUpdate,
    broadcastClipAdd,
    broadcastClipDelete,
    requestSync,
    dismissConflict,
  };
}
