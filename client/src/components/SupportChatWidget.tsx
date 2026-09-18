"use client";

import { useState, useCallback, useRef } from "react";
import { MessageCircle, X } from "lucide-react";
import { AIChatBox, type Message } from "./AIChatBox";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

const SUGGESTED_PROMPTS = [
  "What can DreamForgeX do?",
  "Which plan is right for me?",
  "How do I get started?",
  "Recommend a tool for video",
];

export function SupportChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [retryDraft, setRetryDraft] = useState("");
  const sendLockRef = useRef(false);

  const chatMutation = trpc.supportChat.send.useMutation({
    onSuccess: (response) => {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: response },
      ]);
    },
    onSettled: () => { sendLockRef.current = false; },
    onError: (_error, variables) => {
      setRetryDraft(variables.messages.at(-1)?.content || "");
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "I couldn't get a reply. Your message is ready to retry. You can also email support@dreamforgex.ai.",
        },
      ]);
    },
  });

  const handleSendMessage = useCallback(
    (content: string) => {
      if (!content.trim() || sendLockRef.current || chatMutation.isPending) return;
      sendLockRef.current = true;
      setRetryDraft("");
      const userMessage: Message = { role: "user", content };
      const updatedMessages = [...messages, userMessage];
      setMessages(updatedMessages);
      chatMutation.mutate({ messages: updatedMessages });
    },
    [messages, chatMutation]
  );

  return (
    <>
      {/* Chat Panel */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="DreamForgeX Support"
          onKeyDown={e => { if (e.key === "Escape") setIsOpen(false); }}
          className={cn(
            "fixed bottom-20 right-4 z-[9999] w-[380px] max-w-[calc(100vw-2rem)]",
            "animate-in slide-in-from-bottom-4 fade-in duration-200"
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between rounded-t-xl bg-primary px-4 py-3">
            <div className="flex items-center gap-2">
              <MessageCircle className="size-5 text-primary-foreground" />
              <span className="font-semibold text-primary-foreground text-sm">
                DreamForgeX Support
              </span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              aria-label="Close support chat"
              className="rounded-full p-1 text-primary-foreground/80 transition-colors hover:bg-primary-foreground/10 hover:text-primary-foreground"
            >
              <X className="size-4" />
            </button>
          </div>

          {/* Chat Body */}
          <AIChatBox
            messages={messages}
            onSendMessage={handleSendMessage}
            retryDraft={retryDraft}
            isLoading={chatMutation.isPending}
            placeholder="Ask me anything about DreamForgeX..."
            height="min(420px, calc(100dvh - 10rem))"
            emptyStateMessage="Hi! I'm Forge, your AI assistant. How can I help?"
            suggestedPrompts={SUGGESTED_PROMPTS}
            className="rounded-t-none rounded-b-xl border-t-0 shadow-2xl"
          />
        </div>
      )}

      {/* Floating Toggle Button */}
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className={cn(
          "fixed bottom-4 right-4 z-[9999]",
          "flex size-14 items-center justify-center rounded-full",
          "bg-primary text-primary-foreground shadow-lg",
          "transition-all duration-200 hover:scale-105 hover:shadow-xl",
          "focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 focus:ring-offset-background"
        )}
        aria-label={isOpen ? "Close support chat" : "Open support chat"}
      >
        {isOpen ? (
          <X className="size-6" />
        ) : (
          <MessageCircle className="size-6" />
        )}
      </button>
    </>
  );
}
