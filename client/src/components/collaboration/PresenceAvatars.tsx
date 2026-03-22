/**
 * Row of avatar circles showing who's online in the project.
 * Pulsing indicator for active users, dimmed for idle.
 */

import { useMemo } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { PresenceUser } from "@/hooks/useCollaboration";

interface PresenceAvatarsProps {
  presence: PresenceUser[];
  currentUserId?: number;
  maxVisible?: number;
}

function getInitials(name: string | null): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function statusLabel(status: string): string {
  if (status === "active") return "Active";
  if (status === "idle") return "Idle";
  return "Away";
}

export default function PresenceAvatars({
  presence,
  currentUserId,
  maxVisible = 6,
}: PresenceAvatarsProps) {
  const visibleUsers = useMemo(
    () => presence.slice(0, maxVisible),
    [presence, maxVisible]
  );
  const overflow = presence.length - maxVisible;

  if (presence.length === 0) return null;

  return (
    <TooltipProvider>
      <div className="flex items-center -space-x-2">
        {visibleUsers.map((p) => {
          const isMe = p.user.id === currentUserId;
          const isActive = p.status === "active";
          const isIdle = p.status === "idle";

          return (
            <Tooltip key={p.user.id}>
              <TooltipTrigger asChild>
                <div className="relative">
                  <div
                    className={`
                      w-8 h-8 rounded-full flex items-center justify-center
                      text-xs font-semibold text-white border-2 border-background
                      transition-opacity duration-300 cursor-default
                      ${isIdle ? "opacity-50" : "opacity-100"}
                    `}
                    style={{ backgroundColor: p.color }}
                  >
                    {getInitials(p.user.name)}
                  </div>

                  {/* Pulsing active indicator */}
                  {isActive && (
                    <span className="absolute -bottom-0.5 -right-0.5 flex h-2.5 w-2.5">
                      <span
                        className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
                        style={{ backgroundColor: p.color }}
                      />
                      <span
                        className="relative inline-flex rounded-full h-2.5 w-2.5 border border-background"
                        style={{ backgroundColor: p.color }}
                      />
                    </span>
                  )}

                  {/* Idle indicator (dim dot) */}
                  {isIdle && (
                    <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-yellow-500/60 border border-background" />
                  )}
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                <p className="font-medium">
                  {p.user.name || "Anonymous"}
                  {isMe && " (you)"}
                </p>
                <p className="text-muted-foreground">
                  {statusLabel(p.status)}
                  {p.editingClipId && ` \u00b7 Editing clip`}
                </p>
              </TooltipContent>
            </Tooltip>
          );
        })}

        {overflow > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold bg-muted text-muted-foreground border-2 border-background">
                +{overflow}
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              {overflow} more collaborator{overflow > 1 ? "s" : ""}
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
}
