/**
 * Slide-out chat panel for project collaboration.
 * Real-time messages via WebSocket, system messages, emoji reactions, @mentions.
 */

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import type { ChatMessage, PresenceUser } from "@/hooks/useCollaboration";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  MessageCircle,
  Send,
  Smile,
  AtSign,
  ArrowDown,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

// ─── Emoji picker (lightweight inline) ──────────────────────────────────────

const QUICK_EMOJIS = [
  "\uD83D\uDC4D", "\uD83D\uDC4E", "\u2764\uFE0F", "\uD83D\uDE02",
  "\uD83D\uDE4F", "\uD83D\uDD25", "\uD83C\uDF89", "\uD83E\uDD14",
  "\u2705", "\u274C", "\uD83D\uDE80", "\uD83C\uDFA8",
  "\uD83C\uDFAC", "\uD83C\uDFB5", "\uD83D\uDCA1", "\uD83D\uDC40",
];

// ─── Types ──────────────────────────────────────────────────────────────────

interface ProjectChatProps {
  projectId: number;
  wsMessages: ChatMessage[];
  onSendMessage: (message: string) => void;
  presence: PresenceUser[];
  currentUserId?: number;
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function ProjectChat({
  projectId,
  wsMessages,
  onSendMessage,
  presence,
  currentUserId,
}: ProjectChatProps) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [showMentions, setShowMentions] = useState(false);
  const [mentionFilter, setMentionFilter] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const prevMessageCountRef = useRef(0);

  // Load persistent chat history
  const chatHistory = trpc.collaboration.getProjectChat.useQuery(
    { projectId, limit: 50 },
    { enabled: open }
  );

  // Merge persistent + WS messages, deduplicate by id
  const allMessages = useMemo(() => {
    const persistent = chatHistory.data?.messages ?? [];
    const seen = new Set<number>();
    const merged: ChatMessage[] = [];

    for (const msg of persistent) {
      if (msg.id && !seen.has(msg.id)) {
        seen.add(msg.id);
        merged.push({
          id: msg.id,
          message: msg.message,
          type: msg.type as ChatMessage["type"],
          userName: msg.userName,
          userId: msg.userId,
          createdAt: String(msg.createdAt),
        });
      }
    }

    for (const msg of wsMessages) {
      if (msg.id && seen.has(msg.id)) continue;
      if (msg.id) seen.add(msg.id);
      merged.push(msg);
    }

    return merged;
  }, [chatHistory.data, wsMessages]);

  // Track unread when panel is closed
  useEffect(() => {
    if (!open && allMessages.length > prevMessageCountRef.current) {
      setUnreadCount((c) => c + (allMessages.length - prevMessageCountRef.current));
    }
    prevMessageCountRef.current = allMessages.length;
  }, [allMessages.length, open]);

  // Reset unread when opening
  useEffect(() => {
    if (open) setUnreadCount(0);
  }, [open]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [allMessages.length]);

  // ─── Mention detection ──────────────────────────────────────────

  const mentionableUsers = useMemo(
    () =>
      presence
        .filter((p) => p.user.id !== currentUserId)
        .map((p) => ({ id: p.user.id, name: p.user.name || "Anonymous" })),
    [presence, currentUserId]
  );

  const filteredMentions = useMemo(
    () =>
      mentionableUsers.filter((u) =>
        u.name.toLowerCase().includes(mentionFilter.toLowerCase())
      ),
    [mentionableUsers, mentionFilter]
  );

  const handleInputChange = useCallback((value: string) => {
    setInput(value);

    // Detect @ at cursor position
    const lastAt = value.lastIndexOf("@");
    if (lastAt >= 0 && (lastAt === 0 || value[lastAt - 1] === " ")) {
      const afterAt = value.slice(lastAt + 1);
      if (!afterAt.includes(" ")) {
        setShowMentions(true);
        setMentionFilter(afterAt);
        return;
      }
    }
    setShowMentions(false);
  }, []);

  const insertMention = useCallback(
    (userName: string) => {
      const lastAt = input.lastIndexOf("@");
      const newInput = input.slice(0, lastAt) + `@${userName} `;
      setInput(newInput);
      setShowMentions(false);
      inputRef.current?.focus();
    },
    [input]
  );

  // ─── Send ───────────────────────────────────────────────────────

  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed) return;
    onSendMessage(trimmed);
    setInput("");
    setShowMentions(false);
  }, [input, onSendMessage]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
      if (e.key === "Escape") {
        setShowMentions(false);
      }
    },
    [handleSend]
  );

  // ─── Render message ────────────────────────────────────────────

  function renderMessage(msg: ChatMessage, index: number) {
    const isMe = msg.userId === currentUserId;
    const isSystem = msg.type === "system" || msg.type === "action";

    if (isSystem) {
      return (
        <div
          key={index}
          className="flex justify-center my-1"
        >
          <span className="text-[11px] text-muted-foreground/70 italic px-2">
            {msg.message}
          </span>
        </div>
      );
    }

    return (
      <div
        key={index}
        className={`flex flex-col ${isMe ? "items-end" : "items-start"} mb-2`}
      >
        {!isMe && (
          <span
            className="text-[10px] font-medium mb-0.5 ml-1"
            style={{ color: msg.color || "#8b5cf6" }}
          >
            {msg.userName || "Anonymous"}
          </span>
        )}
        <div
          className={`
            max-w-[85%] px-3 py-1.5 rounded-2xl text-sm leading-relaxed
            ${
              isMe
                ? "bg-violet-600 text-white rounded-br-md"
                : "bg-muted/60 text-foreground rounded-bl-md"
            }
          `}
        >
          {/* Highlight @mentions */}
          {msg.message.split(/(@\w+)/g).map((part, i) =>
            part.startsWith("@") ? (
              <span key={i} className="font-semibold text-violet-300">
                {part}
              </span>
            ) : (
              <span key={i}>{part}</span>
            )
          )}
        </div>
        <span className="text-[9px] text-muted-foreground/50 mt-0.5 mx-1">
          {new Date(msg.createdAt).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>
    );
  }

  // ─── Render ─────────────────────────────────────────────────────

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="relative gap-1.5"
        >
          <MessageCircle className="w-4 h-4" />
          Chat
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1.5 -right-1.5 h-4 min-w-4 px-1 text-[10px] leading-none"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>

      <SheetContent side="right" className="w-[360px] sm:w-[400px] flex flex-col p-0">
        <SheetHeader className="px-4 py-3 border-b">
          <SheetTitle className="text-base flex items-center gap-2">
            <MessageCircle className="w-4 h-4 text-violet-500" />
            Project Chat
            {presence.length > 0 && (
              <Badge variant="secondary" className="text-[10px]">
                {presence.length} online
              </Badge>
            )}
          </SheetTitle>
        </SheetHeader>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-2">
          {allMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center opacity-50">
              <MessageCircle className="w-10 h-10 mb-2 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">
                No messages yet. Start the conversation!
              </p>
            </div>
          ) : (
            allMessages.map((msg, i) => renderMessage(msg, i))
          )}
        </div>

        {/* @mention dropdown */}
        {showMentions && filteredMentions.length > 0 && (
          <div className="mx-3 mb-1 border rounded-lg bg-popover shadow-md max-h-32 overflow-y-auto">
            {filteredMentions.map((u) => (
              <button
                key={u.id}
                className="w-full text-left px-3 py-1.5 text-sm hover:bg-muted/50 transition-colors flex items-center gap-2"
                onClick={() => insertMention(u.name)}
              >
                <AtSign className="w-3 h-3 text-violet-500" />
                {u.name}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div className="border-t px-3 py-2 flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                <Smile className="w-4 h-4 text-muted-foreground" />
              </Button>
            </PopoverTrigger>
            <PopoverContent side="top" className="w-auto p-2">
              <div className="grid grid-cols-8 gap-1">
                {QUICK_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    className="w-7 h-7 flex items-center justify-center hover:bg-muted rounded text-base"
                    onClick={() => {
                      setInput((prev) => prev + emoji);
                      inputRef.current?.focus();
                    }}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            className="h-8 text-sm bg-muted/30 border-0 focus-visible:ring-1"
          />

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-violet-500 hover:text-violet-400"
            onClick={handleSend}
            disabled={!input.trim()}
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
