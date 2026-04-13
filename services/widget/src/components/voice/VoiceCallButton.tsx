import { Mic, MicOff, Phone, PhoneOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useVoiceCall } from "@/hooks/useVoiceCall";
import type { ChatMessage } from "@/types";

interface VoiceCallButtonProps {
  apiUrl: string;
  collegeId: string;
  sessionId: string;
  onTranscript?: (transcript: ChatMessage) => void;
  chatHistory?: ChatMessage[]; // Pass existing text chat for context
}

export function VoiceCallButton({
  apiUrl,
  collegeId,
  sessionId,
  onTranscript,
  chatHistory,
}: VoiceCallButtonProps) {
  const {
    isConnecting,
    isConnected,
    error,
    isMuted,
    isAgentSpeaking,
    connect,
    disconnect,
    toggleMute,
  } = useVoiceCall({ apiUrl, collegeId, sessionId, chatHistory }, onTranscript);

  return (
    <div className="flex items-center gap-3">
      {/* Call/Hang Up Button with Live Indicator */}
      <div className="relative">
        <Button
          variant={isConnected ? "destructive" : "ghost"}
          size="icon"
          onClick={isConnected ? disconnect : connect}
          disabled={isConnecting}
          title={isConnected ? "End Call" : "Start Voice Call"}
          className={
            isConnected
              ? ""
              : "bg-white/20 text-white hover:bg-white/30 hover:text-white border border-white/30"
          }
        >
          {isConnecting ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : isConnected ? (
            <PhoneOff className="h-5 w-5" />
          ) : (
            <Phone className="h-5 w-5" />
          )}
        </Button>

        {/* Red Glowing Pulse - Call is Live */}
        {isConnected && (
          <span className="absolute -top-1 -right-1 flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
          </span>
        )}
      </div>

      {/* Mute Button (only visible when connected) */}
      {isConnected && (
        <Button
          variant={isMuted ? "secondary" : "ghost"}
          size="icon"
          onClick={toggleMute}
          title={isMuted ? "Unmute" : "Mute"}
          className={
            isMuted
              ? ""
              : "bg-white/20 text-white hover:bg-white/30 hover:text-white border border-white/30"
          }
        >
          {isMuted ? (
            <MicOff className="h-5 w-5" />
          ) : (
            <Mic className="h-5 w-5" />
          )}
        </Button>
      )}

      {/* Error Display */}
      {error && (
        <span
          className="text-xs text-red-500 max-w-[200px] truncate"
          title={error}
        >
          {error}
        </span>
      )}
    </div>
  );
}
