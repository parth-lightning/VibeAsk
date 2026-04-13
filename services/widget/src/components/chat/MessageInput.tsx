import { Button } from "@/components/ui/button";
import { Send, AudioLines, Loader2, PhoneOff } from "lucide-react";
import {
  useState,
  useRef,
  useEffect,
  useImperativeHandle,
  forwardRef,
} from "react";
import { useAnimatedPlaceholder } from "@/hooks/useAnimatedPlaceholder";
import { useVoiceCall } from "@/hooks/useVoiceCall";
import type { ChatMessage } from "@/types";

interface MessageInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  hasMessages?: boolean;
  isLoading?: boolean;
  // Voice call props
  apiUrl?: string;
  collegeId?: string;
  sessionId?: string;
  onVoiceTranscript?: (transcript: ChatMessage) => void;
  chatHistory?: ChatMessage[];
  inputRef?: React.RefObject<{
    setValue: (value: string) => void;
    focus: () => void;
  }> | null;
}

export function MessageInput({
  onSend,
  disabled,
  hasMessages = false,
  isLoading = false,
  apiUrl,
  collegeId,
  sessionId,
  onVoiceTranscript,
  chatHistory,
  inputRef,
}: MessageInputProps) {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { placeholder, currentIndex } = useAnimatedPlaceholder();

  // Expose setValue and focus methods via ref
  useEffect(() => {
    if (inputRef && "current" in inputRef) {
      (inputRef as React.MutableRefObject<any>).current = {
        setValue: (value: string) => {
          setInput(value);
          // Focus textarea after setting value
          setTimeout(() => {
            textareaRef.current?.focus();
          }, 0);
        },
        focus: () => textareaRef.current?.focus(),
      };
    }
  }, [inputRef]);

  // Voice call hook
  const {
    isConnecting,
    isConnected,
    isMuted,
    connect,
    disconnect,
    toggleMute,
  } = useVoiceCall(
    apiUrl && collegeId && sessionId
      ? { apiUrl, collegeId, sessionId, chatHistory }
      : null,
    onVoiceTranscript
  );

  // Auto-resize textarea based on content
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
    }
  }, [input]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !disabled) {
      onSend(input.trim());
      setInput("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Submit on Enter without Shift
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleVoiceClick = () => {
    if (isConnected) {
      disconnect();
    } else {
      connect();
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="p-4 bg-white border-t border-gray-100"
    >
      <div className="flex gap-2 items-end">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={hasMessages ? "Type your message..." : placeholder}
          disabled={disabled}
          rows={1}
          className={`flex-1 resize-none rounded-full border border-gray-200 bg-gray-50 px-4 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 disabled:cursor-not-allowed disabled:opacity-50 max-h-[120px] overflow-y-auto ${
            !hasMessages ? "placeholder:animate-placeholder-fade" : ""
          }`}
        />
        <Button
          type={input.trim() ? "submit" : "button"}
          size="icon"
          disabled={disabled || isConnecting || isLoading}
          onClick={input.trim() ? undefined : handleVoiceClick}
          className={`rounded-full ${
            isConnected
              ? "bg-red-500 hover:bg-red-600"
              : "bg-[#2563eb] hover:bg-[#1e3a5f]"
          } text-white relative`}
        >
          {isConnecting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : input.trim() ? (
            <Send className="h-4 w-4" />
          ) : isConnected ? (
            <PhoneOff className="h-4 w-4" />
          ) : (
            <AudioLines className="h-4 w-4" />
          )}

          {/* Red pulse indicator when connected */}
          {isConnected && !input.trim() && (
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
            </span>
          )}

          <span className="sr-only">
            {isConnecting
              ? "Connecting..."
              : input.trim()
              ? "Send message"
              : isConnected
              ? "End call"
              : "Start voice call"}
          </span>
        </Button>
      </div>
    </form>
  );
}
