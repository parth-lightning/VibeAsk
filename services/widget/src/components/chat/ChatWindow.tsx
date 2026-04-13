import { useState, useCallback, useMemo, useRef } from "react";
import { Card } from "@/components/ui/card";
import { ChatHeader } from "./ChatHeader";
import { MessageList } from "./MessageList";
import { MessageInput } from "./MessageInput";
import type { UIMessage, ChatMessage } from "@/types";

interface ChatWindowProps {
  messages: UIMessage[];
  isLoading: boolean;
  onSendMessage: (message: string, voiceHistory?: ChatMessage[]) => void;
  onMinimize: () => void;
  onClose: () => void;
  // Suggestions from data parts (parallel generation)
  suggestions?: string[];
  // Voice call props
  apiUrl?: string;
  collegeId?: string;
  sessionId?: string;
  // Fullscreen mode
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
}

// Internal message type with order index for proper sorting
interface OrderedMessage extends ChatMessage {
  orderIndex: number;
}

/**
 * Extract suggestions from the last assistant message's tool parts
 */
function extractSuggestions(messages: UIMessage[]): string[] {
  // Find the last assistant message
  const lastAssistantMessage = [...messages]
    .reverse()
    .find((msg) => msg.role === "assistant");

  if (!lastAssistantMessage) return [];

  // Check if it has parts
  const msgWithParts = lastAssistantMessage as any;
  if (!msgWithParts.parts || !Array.isArray(msgWithParts.parts)) return [];

  // Find the suggestFollowUpQuestions tool part with output-available state
  const suggestionPart = msgWithParts.parts.find(
    (part: any) =>
      part.type === "tool-suggestFollowUpQuestions" &&
      part.state === "output-available" &&
      part.output?.suggestions
  );

  if (!suggestionPart) return [];

  return suggestionPart.output.suggestions || [];
}

/**
 * Check if any message has an escalateToHuman tool with output-available state
 */
function hasEscalationCompleted(messages: UIMessage[]): boolean {
  return messages.some((msg) => {
    const msgWithParts = msg as any;
    if (!msgWithParts.parts || !Array.isArray(msgWithParts.parts)) return false;

    return msgWithParts.parts.some(
      (part: any) =>
        part.type === "tool-escalateToHuman" &&
        part.state === "output-available"
    );
  });
}

export function ChatWindow({
  messages,
  isLoading,
  onSendMessage,
  onMinimize,
  onClose,
  suggestions: dataSuggestions = [], // From data parts
  apiUrl,
  collegeId,
  sessionId,
  isFullscreen = false,
  onToggleFullscreen,
}: ChatWindowProps) {
  // Store voice transcripts separately with their order index
  const [voiceMessages, setVoiceMessages] = useState<OrderedMessage[]>([]);

  // Global order counter - increments for each message (text or voice)
  const orderCounter = useRef<number>(0);

  // Track which text message IDs we've already assigned order to
  const textMessageOrders = useRef<Map<string, number>>(new Map());

  // Handler for voice transcripts coming from LiveKit
  const handleVoiceTranscript = useCallback((transcript: ChatMessage) => {
    // Assign the next order index to this voice message
    const order = orderCounter.current++;
    const voiceMsg: OrderedMessage = {
      ...transcript,
      createdAt: transcript.createdAt || new Date(),
      orderIndex: order,
    };
    setVoiceMessages((prev) => [...prev, voiceMsg]);
  }, []);

  // Merge text messages (UIMessage) with voice messages (ChatMessage)
  // Sort by order index to maintain chronological order
  const allMessages = useMemo(() => {
    // Keep UIMessage structure intact (with parts) but add order index
    const textMessages = messages.map((msg) => {
      // Get or create a stable order index for this message
      let order = textMessageOrders.current.get(msg.id);
      if (order === undefined) {
        // New text message - assign next order index
        order = orderCounter.current++;
        textMessageOrders.current.set(msg.id, order);
      }

      // Preserve the original UIMessage with parts, just add orderIndex
      return {
        ...msg,
        orderIndex: order,
        isVoice: false,
      };
    });

    // Combine with voice messages (which don't have parts)
    const combined = [...textMessages, ...voiceMessages];

    // Sort by order index (simple numeric comparison)
    return combined.sort((a, b) => a.orderIndex - b.orderIndex);
  }, [messages, voiceMessages]);

  // Check if conversation has been escalated
  const isEscalated = useMemo(
    () => hasEscalationCompleted(messages),
    [messages]
  );

  // Use data suggestions (from parallel generation) if available,
  // otherwise fall back to tool-based suggestions
  const toolSuggestions = useMemo(() => {
    if (isLoading) return [];
    return extractSuggestions(messages);
  }, [messages, isLoading]);

  // Prefer data suggestions (faster), fall back to tool suggestions
  const suggestions =
    dataSuggestions.length > 0 ? dataSuggestions : toolSuggestions;

  // Handle suggestion click
  const handleSuggestionClick = useCallback(
    (suggestion: string) => {
      onSendMessage(suggestion, voiceMessages);
    },
    [onSendMessage, voiceMessages]
  );

  // Create ref for MessageInput to set value programmatically
  const messageInputRef = useRef<{
    setValue: (value: string) => void;
    focus: () => void;
  }>(null);

  const handleTopicClick = useCallback((topic: string) => {
    // Set the topic in the input field, user will press Enter to send
    messageInputRef.current?.setValue(topic);
  }, []);

  // Fullscreen: Click backdrop to exit
  const handleBackdropClick = () => {
    if (isFullscreen && onToggleFullscreen) {
      onToggleFullscreen();
    }
  };

  const handleCardClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  if (isFullscreen) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm animate-fade-in"
        onClick={handleBackdropClick}
      >
        <Card
          className="w-full max-w-4xl h-[90vh] flex flex-col shadow-2xl border-0 overflow-hidden rounded-2xl bg-[#FFF4E1] transition-all duration-300 ease-in-out"
          onClick={handleCardClick}
        >
          {/* Header */}
          <div className="relative">
            <ChatHeader
              onMinimize={onMinimize}
              onClose={onClose}
              onToggleFullscreen={onToggleFullscreen}
              isFullscreen={isFullscreen}
            />
          </div>
          {/* Main chat area */}
          <div
            className="flex-1 flex flex-col overflow-hidden relative"
            style={{
              backgroundColor: "#FFF4E1",
              backgroundImage:
                "url(https://sih-widget.vercel.app/chatbot-background.webp)",
              backgroundRepeat: "repeat",
              backgroundSize: "auto",
              backgroundPosition: "center",
            }}
          >
            <MessageList
              messages={allMessages}
              isLoading={isLoading}
              suggestions={
                !isEscalated && suggestions.length > 0 ? suggestions : undefined
              }
              onSuggestionClick={handleSuggestionClick}
              onTopicClick={handleTopicClick}
              isFullscreen={isFullscreen}
            />
            <MessageInput
              onSend={(msg) => onSendMessage(msg, voiceMessages)}
              disabled={isLoading || isEscalated}
              hasMessages={
                allMessages.length > 1 ||
                (allMessages.length === 1 &&
                  allMessages[0]?.id !== "greeting-1")
              }
              isLoading={isLoading}
              apiUrl={apiUrl}
              collegeId={collegeId}
              sessionId={sessionId}
              onVoiceTranscript={handleVoiceTranscript}
              chatHistory={allMessages}
              inputRef={messageInputRef}
            />
          </div>
        </Card>
      </div>
    );
  }

  return (
    <Card className="fixed bottom-20 right-6 w-[400px] h-[600px] flex flex-col shadow-2xl animate-slide-up z-50 border-0 overflow-hidden rounded-2xl bg-[#FFF4E1]">
      {/* Tri-color header with logo */}
      <div className="relative">
        <ChatHeader
          onMinimize={onMinimize}
          onClose={onClose}
          onToggleFullscreen={onToggleFullscreen}
          isFullscreen={isFullscreen}
        />
      </div>
      {/* Rajasthan-themed main chat area with background pattern and cream color */}
      <div
        className="flex-1 flex flex-col overflow-hidden relative"
        style={{
          backgroundColor: "#FFF4E1",
          backgroundImage:
            "url(https://sih-widget.vercel.app/chatbot-background.webp)",
          backgroundRepeat: "repeat",
          backgroundSize: "auto",
          backgroundPosition: "center",
        }}
      >
        <MessageList
          messages={allMessages}
          isLoading={isLoading}
          suggestions={
            !isEscalated && suggestions.length > 0 ? suggestions : undefined
          }
          onSuggestionClick={handleSuggestionClick}
          onTopicClick={handleTopicClick}
          isFullscreen={isFullscreen}
        />
        <MessageInput
          onSend={(msg) => onSendMessage(msg, voiceMessages)}
          disabled={isLoading || isEscalated}
          hasMessages={
            allMessages.length > 1 ||
            (allMessages.length === 1 && allMessages[0]?.id !== "greeting-1")
          }
          isLoading={isLoading}
          apiUrl={apiUrl}
          collegeId={collegeId}
          sessionId={sessionId}
          onVoiceTranscript={handleVoiceTranscript}
          chatHistory={allMessages}
          inputRef={messageInputRef}
        />
      </div>
    </Card>
  );
}
