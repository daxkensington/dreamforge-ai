/**
 * Operational Transform / Conflict Resolution for real-time collaboration.
 *
 * Strategy: Last-Write-Wins with soft-locking and conflict notification.
 * - When a user starts dragging a clip, they acquire a soft lock.
 * - Other users are notified and prevented from editing the same clip.
 * - If two edits arrive for the same clip without locking, the later timestamp wins.
 * - New joiners receive the full current state via sync_response.
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ClipState {
  id: string;
  trackIndex: number;
  startTime: number;
  duration: number;
  data: unknown;
  lastEditedBy: number;
  lastEditedAt: number;
  version: number;
}

export interface ProjectState {
  clips: Map<string, ClipState>;
  version: number;
}

// ─── In-memory project states ───────────────────────────────────────────────

const projectStates = new Map<string, ProjectState>();

export function getProjectState(projectId: string): ProjectState {
  if (!projectStates.has(projectId)) {
    projectStates.set(projectId, { clips: new Map(), version: 0 });
  }
  return projectStates.get(projectId)!;
}

export function initProjectState(projectId: string, clips: ClipState[]): void {
  const state: ProjectState = {
    clips: new Map(clips.map((c) => [c.id, c])),
    version: clips.reduce((max, c) => Math.max(max, c.version), 0),
  };
  projectStates.set(projectId, state);
}

// ─── Operations ─────────────────────────────────────────────────────────────

export interface ClipOperation {
  type: "add" | "update" | "delete";
  clipId: string;
  userId: number;
  timestamp: number;
  data?: Partial<ClipState>;
}

export interface OperationResult {
  accepted: boolean;
  conflict: boolean;
  conflictWith?: { userId: number; name?: string };
  newState?: ClipState;
}

/**
 * Apply a clip operation using Last-Write-Wins conflict resolution.
 */
export function applyOperation(
  projectId: string,
  op: ClipOperation,
  lockedBy?: number
): OperationResult {
  const state = getProjectState(projectId);

  switch (op.type) {
    case "add": {
      if (state.clips.has(op.clipId)) {
        return { accepted: false, conflict: true };
      }
      const newClip: ClipState = {
        id: op.clipId,
        trackIndex: (op.data as any)?.trackIndex ?? 0,
        startTime: (op.data as any)?.startTime ?? 0,
        duration: (op.data as any)?.duration ?? 1,
        data: op.data,
        lastEditedBy: op.userId,
        lastEditedAt: op.timestamp,
        version: ++state.version,
      };
      state.clips.set(op.clipId, newClip);
      return { accepted: true, conflict: false, newState: newClip };
    }

    case "update": {
      const existing = state.clips.get(op.clipId);
      if (!existing) {
        return { accepted: false, conflict: false };
      }

      // Check soft lock
      if (lockedBy !== undefined && lockedBy !== op.userId) {
        return {
          accepted: false,
          conflict: true,
          conflictWith: { userId: lockedBy },
        };
      }

      // Last-write-wins: accept if timestamp is newer or equal
      if (op.timestamp < existing.lastEditedAt) {
        return {
          accepted: false,
          conflict: true,
          conflictWith: { userId: existing.lastEditedBy },
        };
      }

      const updatedClip: ClipState = {
        ...existing,
        ...op.data,
        id: op.clipId,
        lastEditedBy: op.userId,
        lastEditedAt: op.timestamp,
        version: ++state.version,
      };
      state.clips.set(op.clipId, updatedClip);
      return { accepted: true, conflict: false, newState: updatedClip };
    }

    case "delete": {
      const existing = state.clips.get(op.clipId);
      if (!existing) {
        return { accepted: false, conflict: false };
      }

      // Check soft lock
      if (lockedBy !== undefined && lockedBy !== op.userId) {
        return {
          accepted: false,
          conflict: true,
          conflictWith: { userId: lockedBy },
        };
      }

      state.clips.delete(op.clipId);
      state.version++;
      return { accepted: true, conflict: false };
    }

    default:
      return { accepted: false, conflict: false };
  }
}

/**
 * Get a serializable snapshot of the full project state for new joiners.
 */
export function getStateSnapshot(projectId: string): {
  clips: ClipState[];
  version: number;
} {
  const state = getProjectState(projectId);
  return {
    clips: [...state.clips.values()],
    version: state.version,
  };
}

/**
 * Clean up state for a project that has no more active users.
 */
export function cleanupProjectState(projectId: string): void {
  projectStates.delete(projectId);
}
