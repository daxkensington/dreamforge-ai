/**
 * Renders colored cursors on the timeline for each collaborator.
 * Shows name label above cursor with smooth interpolation.
 */

import { useState, useEffect, useRef, useMemo } from "react";
import type { PresenceUser } from "@/hooks/useCollaboration";

interface CollaboratorCursorsProps {
  presence: PresenceUser[];
  currentUserId?: number;
  /** Bounding container for cursor rendering (timeline element) */
  containerRef?: React.RefObject<HTMLElement | null>;
}

interface InterpolatedCursor {
  userId: number;
  name: string | null;
  color: string;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  editingClipId: string | null;
}

export default function CollaboratorCursors({
  presence,
  currentUserId,
  containerRef,
}: CollaboratorCursorsProps) {
  const cursorsRef = useRef<Map<number, InterpolatedCursor>>(new Map());
  const [renderTick, setRenderTick] = useState(0);
  const rafRef = useRef<number | null>(null);

  // Filter to only users with cursor positions (not current user)
  const activeCursors = useMemo(
    () =>
      presence.filter(
        (p) =>
          p.user.id !== currentUserId &&
          p.cursor !== null &&
          p.status !== "away"
      ),
    [presence, currentUserId]
  );

  // Update target positions when presence changes
  useEffect(() => {
    const map = cursorsRef.current;

    // Remove users no longer present
    for (const [uid] of map) {
      if (!activeCursors.find((p) => p.user.id === uid)) {
        map.delete(uid);
      }
    }

    // Update or create cursor entries
    for (const p of activeCursors) {
      if (!p.cursor) continue;
      const existing = map.get(p.user.id);
      if (existing) {
        existing.targetX = p.cursor.x;
        existing.targetY = p.cursor.y;
        existing.name = p.user.name;
        existing.color = p.color;
        existing.editingClipId = p.editingClipId;
      } else {
        map.set(p.user.id, {
          userId: p.user.id,
          name: p.user.name,
          color: p.color,
          x: p.cursor.x,
          y: p.cursor.y,
          targetX: p.cursor.x,
          targetY: p.cursor.y,
          editingClipId: p.editingClipId,
        });
      }
    }
  }, [activeCursors]);

  // Smooth interpolation loop
  useEffect(() => {
    const LERP_SPEED = 0.15;

    function animate() {
      let changed = false;
      for (const [, cursor] of cursorsRef.current) {
        const dx = cursor.targetX - cursor.x;
        const dy = cursor.targetY - cursor.y;
        if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
          cursor.x += dx * LERP_SPEED;
          cursor.y += dy * LERP_SPEED;
          changed = true;
        } else {
          cursor.x = cursor.targetX;
          cursor.y = cursor.targetY;
        }
      }
      if (changed) {
        setRenderTick((t) => t + 1);
      }
      rafRef.current = requestAnimationFrame(animate);
    }

    rafRef.current = requestAnimationFrame(animate);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  if (activeCursors.length === 0) return null;

  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden z-50"
      aria-hidden="true"
    >
      {[...cursorsRef.current.values()].map((cursor) => (
        <div
          key={cursor.userId}
          className="absolute transition-opacity duration-200"
          style={{
            transform: `translate(${cursor.x}px, ${cursor.y}px)`,
            willChange: "transform",
          }}
        >
          {/* Cursor arrow SVG */}
          <svg
            width="16"
            height="20"
            viewBox="0 0 16 20"
            fill="none"
            className="drop-shadow-md"
          >
            <path
              d="M0 0L16 12L8 12L4 20L0 0Z"
              fill={cursor.color}
              stroke="white"
              strokeWidth="1"
            />
          </svg>

          {/* Name label */}
          <div
            className="absolute left-4 -top-1 px-1.5 py-0.5 rounded text-[10px] font-medium text-white whitespace-nowrap shadow-sm"
            style={{ backgroundColor: cursor.color }}
          >
            {cursor.name || "Anonymous"}
            {cursor.editingClipId && (
              <span className="ml-1 opacity-75">editing</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
