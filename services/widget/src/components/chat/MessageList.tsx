import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageBubble } from "./MessageBubble";
import { TypingIndicator } from "./TypingIndicator";
import { Suggestions } from "./Suggestions";
import { InitialSuggestions } from "./InitialSuggestions";
import type { ChatMessage } from "@/types";
import { useEffect, useRef } from "react";

interface MessageListProps {
  messages: ChatMessage[];
  isLoading?: boolean;
  suggestions?: string[];
  onSuggestionClick?: (suggestion: string) => void;
  onTopicClick?: (topic: string) => void;
}

export function MessageList({
  messages,
  isLoading,
  suggestions,
  onSuggestionClick,
  onTopicClick,
}: MessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change or are streaming
  useEffect(() => {
    const scrollToBottom = () => {
      if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({
          behavior: "smooth",
          block: "end",
        });
      }
    };

    // Use a small delay to ensure DOM has updated with new content
    const timeoutId = setTimeout(scrollToBottom, 100);

    return () => clearTimeout(timeoutId);
  }, [messages, isLoading]);

  // Also scroll when message content changes (streaming)
  useEffect(() => {
    const scrollToBottom = () => {
      if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({
          behavior: "smooth",
          block: "end",
        });
      }
    };

    // Monitor for content changes more frequently during streaming
    const intervalId = setInterval(() => {
      if (
        isLoading ||
        messages.some((msg) => {
          // Check if message has parts (UIMessage format)
          const hasParts = "parts" in msg && Array.isArray((msg as any).parts);
          return (
            hasParts &&
            (msg as any).parts?.some(
              (part: any) => part.state === "input-streaming"
            )
          );
        })
      ) {
        scrollToBottom();
      }
    }, 300);

    return () => clearInterval(intervalId);
  }, [messages, isLoading]);

  if (messages.length === 0 && !isLoading) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500 text-sm">
        <p>Start a conversation...</p>
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1 px-4 py-4" ref={scrollAreaRef}>
      <div className="flex flex-col gap-4">
        {messages.map((message, index) => {
          const isFirstMessage = index === 0 && message.id === "greeting-1";
          const isLastMessage = index === messages.length - 1;
          const isAssistantMessage = message.role === "assistant";
          const shouldShowSuggestions =
            isLastMessage &&
            isAssistantMessage &&
            !isLoading &&
            suggestions &&
            suggestions.length > 0 &&
            onSuggestionClick;
          const shouldShowInitialSuggestions =
            isFirstMessage &&
            messages.length === 1 &&
            !isLoading &&
            onTopicClick;

          return (
            <div key={message.id}>
              <MessageBubble message={message} />
              {shouldShowInitialSuggestions && (
                <InitialSuggestions onTopicClick={onTopicClick} />
              )}
              {shouldShowSuggestions && (
                <Suggestions
                  suggestions={suggestions}
                  onSuggestionClick={onSuggestionClick}
                />
              )}
            </div>
          );
        })}
        {isLoading && <TypingIndicator />}
        {/* Invisible div at the end to scroll to */}
        <div ref={messagesEndRef} className="h-0" />
      </div>
    </ScrollArea>
  );
}
