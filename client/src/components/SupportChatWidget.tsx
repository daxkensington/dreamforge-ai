"use client";

import { useState, useCallback } from "react";
import { MessageCircle, X } from "lucide-react";
import { AIChatBox, type Message } from "./AIChatBox";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

const SUGGESTED_PROMPTS = [
  "What can DreamForge do?",
  "Which plan is right for me?",
  "How do I get started?",
  "Recommend a tool for video",
];

export function SupportChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);

  const chatMutation = trpc.supportChat.send.useMutation({
    onSuccess: (response) => {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: response },
      ]);
    },
    onError: () => {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "Sorry, I'm having trouble connecting right now. Please try again in a moment.",
        },
      ]);
    },
  });

  const handleSendMessage = useCallback(
    (content: string) => {
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
                DreamForge Support
              </span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="rounded-full p-1 text-primary-foreground/80 transition-colors hover:bg-primary-foreground/10 hover:text-primary-foreground"
            >
              <X className="size-4" />
            </button>
          </div>

          {/* Chat Body */}
          <AIChatBox
            messages={messages}
            onSendMessage={handleSendMessage}
            isLoading={chatMutation.isPending}
            placeholder="Ask me anything about DreamForge..."
            height="420px"
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
