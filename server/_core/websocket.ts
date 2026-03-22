/**
 * WebSocket server for real-time collaboration.
 *
 * NOTE: The `ws` package is NOT in package.json yet.
 *       Run `pnpm add ws && pnpm add -D @types/ws` before using this module.
 */

import type { Server as HttpServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { parse as parseCookieHeader } from "cookie";
import { COOKIE_NAME } from "@shared/const";
import { sdk } from "./sdk";
import * as db from "../db";
import type { User } from "../../drizzle/schema";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface WSMessage {
  type:
    | "join"
    | "leave"
    | "cursor"
    | "clip_update"
    | "clip_add"
    | "clip_delete"
    | "chat"
    | "presence"
    | "sync_request"
    | "sync_response"
    | "lock"
    | "unlock"
    | "conflict";
  projectId: string;
  userId: number;
  payload: unknown;
  timestamp: number;
}

interface PresenceEntry {
  user: { id: number; name: string | null; email: string | null };
  color: string;
  cursor: { x: number; y: number } | null;
  editingClipId: string | null;
  lastActivity: number;
  status: "active" | "idle" | "away";
}

interface AuthenticatedSocket extends WebSocket {
  user: User;
  projectId: string | null;
  isAlive: boolean;
}

// ─── Collaborator colors (rotating palette) ─────────────────────────────────

const CURSOR_COLORS = [
  "#8b5cf6", // violet
  "#06b6d4", // cyan
  "#f59e0b", // amber
  "#ec4899", // pink
  "#10b981", // emerald
  "#ef4444", // red
  "#3b82f6", // blue
  "#f97316", // orange
  "#14b8a6", // teal
  "#a855f7", // purple
];

// ─── State ──────────────────────────────────────────────────────────────────

// projectId -> Map<userId, PresenceEntry>
const rooms = new Map<string, Map<number, PresenceEntry>>();

// projectId -> Map<clipId, userId> (soft locks)
const clipLocks = new Map<string, Map<string, number>>();

// projectId -> Set<AuthenticatedSocket>
const roomSockets = new Map<string, Set<AuthenticatedSocket>>();

// ─── Helpers ────────────────────────────────────────────────────────────────

function getRoom(projectId: string): Map<number, PresenceEntry> {
  if (!rooms.has(projectId)) rooms.set(projectId, new Map());
  return rooms.get(projectId)!;
}

function getRoomSockets(projectId: string): Set<AuthenticatedSocket> {
  if (!roomSockets.has(projectId)) roomSockets.set(projectId, new Set());
  return roomSockets.get(projectId)!;
}

function getClipLocks(projectId: string): Map<string, number> {
  if (!clipLocks.has(projectId)) clipLocks.set(projectId, new Map());
  return clipLocks.get(projectId)!;
}

function assignColor(projectId: string, userId: number): string {
  const room = getRoom(projectId);
  const usedColors = new Set([...room.values()].map((e) => e.color));
  for (const color of CURSOR_COLORS) {
    if (!usedColors.has(color)) return color;
  }
  return CURSOR_COLORS[userId % CURSOR_COLORS.length];
}

function broadcast(projectId: string, message: WSMessage, excludeUserId?: number) {
  const sockets = getRoomSockets(projectId);
  const data = JSON.stringify(message);
  for (const ws of sockets) {
    if (excludeUserId !== undefined && ws.user.id === excludeUserId) continue;
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(data);
    }
  }
}

function broadcastPresence(projectId: string) {
  const room = getRoom(projectId);
  const locks = getClipLocks(projectId);
  const presenceList = [...room.entries()].map(([uid, entry]) => ({
    ...entry,
    locks: [...locks.entries()].filter(([, u]) => u === uid).map(([clipId]) => clipId),
  }));
  const msg: WSMessage = {
    type: "presence",
    projectId,
    userId: 0,
    payload: presenceList,
    timestamp: Date.now(),
  };
  broadcast(projectId, msg);
}

// ─── Idle detection ─────────────────────────────────────────────────────────

const IDLE_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes
const AWAY_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

function runIdleCheck() {
  const now = Date.now();
  for (const [projectId, room] of rooms) {
    let changed = false;
    const sockets = getRoomSockets(projectId);

    for (const [userId, entry] of room) {
      const elapsed = now - entry.lastActivity;

      if (elapsed >= AWAY_TIMEOUT_MS) {
        // Remove user entirely
        room.delete(userId);
        // Release their locks
        const locks = getClipLocks(projectId);
        for (const [clipId, lockOwner] of locks) {
          if (lockOwner === userId) locks.delete(clipId);
        }
        // Close their sockets
        for (const ws of sockets) {
          if (ws.user.id === userId) {
            ws.close(4001, "Idle timeout");
            sockets.delete(ws);
          }
        }
        broadcast(projectId, {
          type: "leave",
          projectId,
          userId,
          payload: { reason: "idle_timeout" },
          timestamp: now,
        });
        changed = true;
      } else if (elapsed >= IDLE_TIMEOUT_MS && entry.status !== "idle") {
        entry.status = "idle";
        changed = true;
      }
    }

    if (changed) broadcastPresence(projectId);

    // Clean up empty rooms
    if (room.size === 0) {
      rooms.delete(projectId);
      clipLocks.delete(projectId);
      roomSockets.delete(projectId);
    }
  }
}

// ─── Message Handlers ───────────────────────────────────────────────────────

async function handleJoin(ws: AuthenticatedSocket, msg: WSMessage) {
  const projectId = msg.projectId;

  // Verify access: must be owner or collaborator
  const pid = parseInt(projectId, 10);
  if (isNaN(pid)) return;

  const ownProject = await db.getVideoProject(pid, ws.user.id);
  const collabRole = ownProject ? "owner" : await db.getUserCollaboratorRole(pid, ws.user.id);
  if (!ownProject && !collabRole) {
    ws.send(JSON.stringify({ type: "error", payload: { message: "Access denied" }, timestamp: Date.now() }));
    ws.close(4003, "Access denied");
    return;
  }

  // Leave previous room if any
  if (ws.projectId && ws.projectId !== projectId) {
    handleLeave(ws);
  }

  ws.projectId = projectId;
  const room = getRoom(projectId);
  const sockets = getRoomSockets(projectId);
  sockets.add(ws);

  const color = assignColor(projectId, ws.user.id);
  room.set(ws.user.id, {
    user: { id: ws.user.id, name: ws.user.name, email: ws.user.email },
    color,
    cursor: null,
    editingClipId: null,
    lastActivity: Date.now(),
    status: "active",
  });

  // Notify others
  broadcast(projectId, {
    type: "join",
    projectId,
    userId: ws.user.id,
    payload: { name: ws.user.name, color },
    timestamp: Date.now(),
  }, ws.user.id);

  // Send full presence state to joiner
  broadcastPresence(projectId);

  // Send current lock state
  const locks = getClipLocks(projectId);
  ws.send(JSON.stringify({
    type: "sync_response",
    projectId,
    userId: 0,
    payload: {
      locks: Object.fromEntries(locks),
      presence: [...room.entries()].map(([, e]) => e),
    },
    timestamp: Date.now(),
  }));
}

function handleLeave(ws: AuthenticatedSocket) {
  const projectId = ws.projectId;
  if (!projectId) return;

  const room = getRoom(projectId);
  const sockets = getRoomSockets(projectId);
  room.delete(ws.user.id);
  sockets.delete(ws);

  // Release locks held by this user
  const locks = getClipLocks(projectId);
  for (const [clipId, owner] of locks) {
    if (owner === ws.user.id) locks.delete(clipId);
  }

  ws.projectId = null;

  broadcast(projectId, {
    type: "leave",
    projectId,
    userId: ws.user.id,
    payload: { name: ws.user.name },
    timestamp: Date.now(),
  });

  broadcastPresence(projectId);
}

function handleCursor(ws: AuthenticatedSocket, msg: WSMessage) {
  const projectId = ws.projectId;
  if (!projectId) return;
  const room = getRoom(projectId);
  const entry = room.get(ws.user.id);
  if (!entry) return;

  const { x, y } = msg.payload as { x: number; y: number };
  entry.cursor = { x, y };
  entry.lastActivity = Date.now();
  entry.status = "active";

  // Broadcast cursor position to others (don't echo back)
  broadcast(projectId, {
    type: "cursor",
    projectId,
    userId: ws.user.id,
    payload: { x, y, color: entry.color, name: entry.user.name },
    timestamp: Date.now(),
  }, ws.user.id);
}

function handleLock(ws: AuthenticatedSocket, msg: WSMessage) {
  const projectId = ws.projectId;
  if (!projectId) return;

  const { clipId } = msg.payload as { clipId: string };
  const locks = getClipLocks(projectId);

  // Check if already locked by someone else
  const currentHolder = locks.get(clipId);
  if (currentHolder !== undefined && currentHolder !== ws.user.id) {
    const room = getRoom(projectId);
    const holder = room.get(currentHolder);
    ws.send(JSON.stringify({
      type: "conflict",
      projectId,
      userId: ws.user.id,
      payload: {
        clipId,
        lockedBy: currentHolder,
        lockedByName: holder?.user.name ?? "Unknown",
      },
      timestamp: Date.now(),
    }));
    return;
  }

  locks.set(clipId, ws.user.id);
  const room = getRoom(projectId);
  const entry = room.get(ws.user.id);
  if (entry) {
    entry.editingClipId = clipId;
    entry.lastActivity = Date.now();
    entry.status = "active";
  }

  broadcast(projectId, {
    type: "lock",
    projectId,
    userId: ws.user.id,
    payload: { clipId, name: ws.user.name },
    timestamp: Date.now(),
  }, ws.user.id);

  broadcastPresence(projectId);
}

function handleUnlock(ws: AuthenticatedSocket, msg: WSMessage) {
  const projectId = ws.projectId;
  if (!projectId) return;

  const { clipId } = msg.payload as { clipId: string };
  const locks = getClipLocks(projectId);

  // Only the holder can unlock
  if (locks.get(clipId) === ws.user.id) {
    locks.delete(clipId);
  }

  const room = getRoom(projectId);
  const entry = room.get(ws.user.id);
  if (entry && entry.editingClipId === clipId) {
    entry.editingClipId = null;
  }

  broadcast(projectId, {
    type: "unlock",
    projectId,
    userId: ws.user.id,
    payload: { clipId },
    timestamp: Date.now(),
  }, ws.user.id);

  broadcastPresence(projectId);
}

function handleClipChange(ws: AuthenticatedSocket, msg: WSMessage) {
  const projectId = ws.projectId;
  if (!projectId) return;

  const room = getRoom(projectId);
  const entry = room.get(ws.user.id);
  if (entry) {
    entry.lastActivity = Date.now();
    entry.status = "active";
  }

  // Last-write-wins: broadcast the change to all others
  broadcast(projectId, {
    type: msg.type,
    projectId,
    userId: ws.user.id,
    payload: msg.payload,
    timestamp: Date.now(),
  }, ws.user.id);
}

function handleChat(ws: AuthenticatedSocket, msg: WSMessage) {
  const projectId = ws.projectId;
  if (!projectId) return;

  const room = getRoom(projectId);
  const entry = room.get(ws.user.id);
  if (entry) {
    entry.lastActivity = Date.now();
    entry.status = "active";
  }

  // Broadcast to ALL in room (including sender for confirmation)
  broadcast(projectId, {
    type: "chat",
    projectId,
    userId: ws.user.id,
    payload: {
      ...(msg.payload as Record<string, unknown>),
      userName: ws.user.name,
      color: entry?.color,
    },
    timestamp: Date.now(),
  });
}

// ─── Authentication ─────────────────────────────────────────────────────────

async function authenticateWs(req: { headers: Record<string, string | string[] | undefined> }): Promise<User | null> {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader || typeof cookieHeader !== "string") return null;

  const cookies = parseCookieHeader(cookieHeader);
  const sessionCookie = cookies[COOKIE_NAME];
  if (!sessionCookie) return null;

  const session = await sdk.verifySession(sessionCookie);
  if (!session) return null;

  const user = await db.getUserByOpenId(session.openId);
  return user ?? null;
}

// ─── Server Setup ───────────────────────────────────────────────────────────

let idleInterval: ReturnType<typeof setInterval> | null = null;
let heartbeatInterval: ReturnType<typeof setInterval> | null = null;

export function setupWebSocketServer(httpServer: HttpServer): WebSocketServer {
  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

  wss.on("connection", async (rawWs, req) => {
    const ws = rawWs as AuthenticatedSocket;

    // Authenticate
    const user = await authenticateWs(req);
    if (!user) {
      ws.close(4001, "Unauthorized");
      return;
    }

    ws.user = user;
    ws.projectId = null;
    ws.isAlive = true;

    console.log(`[WS] User ${user.id} (${user.name}) connected`);

    ws.on("pong", () => {
      ws.isAlive = true;
    });

    ws.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as WSMessage;
        // Stamp userId from authenticated socket (prevent spoofing)
        msg.userId = ws.user.id;

        switch (msg.type) {
          case "join":
            handleJoin(ws, msg);
            break;
          case "leave":
            handleLeave(ws);
            break;
          case "cursor":
            handleCursor(ws, msg);
            break;
          case "lock":
            handleLock(ws, msg);
            break;
          case "unlock":
            handleUnlock(ws, msg);
            break;
          case "clip_update":
          case "clip_add":
          case "clip_delete":
            handleClipChange(ws, msg);
            break;
          case "chat":
            handleChat(ws, msg);
            break;
          case "sync_request":
            // Re-send current state
            if (ws.projectId) {
              const room = getRoom(ws.projectId);
              const locks = getClipLocks(ws.projectId);
              ws.send(JSON.stringify({
                type: "sync_response",
                projectId: ws.projectId,
                userId: 0,
                payload: {
                  locks: Object.fromEntries(locks),
                  presence: [...room.entries()].map(([, e]) => e),
                },
                timestamp: Date.now(),
              }));
            }
            break;
          default:
            break;
        }
      } catch (err) {
        console.error("[WS] Failed to parse message:", err);
      }
    });

    ws.on("close", () => {
      console.log(`[WS] User ${user.id} (${user.name}) disconnected`);
      handleLeave(ws);
    });

    ws.on("error", (err) => {
      console.error(`[WS] Error for user ${user.id}:`, err);
      handleLeave(ws);
    });
  });

  // Heartbeat (detect dead connections)
  heartbeatInterval = setInterval(() => {
    wss.clients.forEach((rawWs) => {
      const ws = rawWs as AuthenticatedSocket;
      if (!ws.isAlive) {
        handleLeave(ws);
        ws.terminate();
        return;
      }
      ws.isAlive = false;
      ws.ping();
    });
  }, 30_000);

  // Idle detection
  idleInterval = setInterval(runIdleCheck, 30_000);

  wss.on("close", () => {
    if (heartbeatInterval) clearInterval(heartbeatInterval);
    if (idleInterval) clearInterval(idleInterval);
  });

  console.log("[WS] WebSocket server initialized on /ws");
  return wss;
}

// ─── Exported helpers for use by tRPC routes ────────────────────────────────

/** Broadcast a chat message from a tRPC route into the WS room */
export function broadcastChatFromServer(
  projectId: string,
  userId: number,
  payload: Record<string, unknown>
) {
  broadcast(projectId, {
    type: "chat",
    projectId,
    userId,
    payload,
    timestamp: Date.now(),
  });
}

/** Broadcast an activity event from a tRPC route into the WS room */
export function broadcastActivityFromServer(
  projectId: string,
  userId: number,
  action: string,
  details: unknown
) {
  broadcast(projectId, {
    type: "clip_update",
    projectId,
    userId,
    payload: { action, details },
    timestamp: Date.now(),
  });
}

/** Get current online users for a project */
export function getOnlineUsers(projectId: string): Array<{
  userId: number;
  name: string | null;
  color: string;
  status: string;
}> {
  const room = rooms.get(projectId);
  if (!room) return [];
  return [...room.values()].map((e) => ({
    userId: e.user.id,
    name: e.user.name,
    color: e.color,
    status: e.status,
  }));
}
