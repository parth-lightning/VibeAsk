import { useState, useEffect, useCallback, useRef } from "react";
import {
  Room,
  RoomEvent,
  Track,
  RemoteTrack,
  RemoteTrackPublication,
  RemoteParticipant,
} from "livekit-client";
import type { ChatMessage } from "@/types";
import { getUserEmail } from "@/lib/session";

interface VoiceCallConfig {
  apiUrl: string; // Express.js API base URL
  collegeId: string;
  sessionId: string;
  chatHistory?: ChatMessage[]; // Previous text chat messages for context
}

interface TranscriptData {
  type: "transcript";
  role: "user" | "agent";
  text: string;
  timestamp: number;
}

interface UseVoiceCallReturn {
  // Connection state
  isConnecting: boolean;
  isConnected: boolean;
  error: string | null;

  // Audio state
  isMuted: boolean;
  isAgentSpeaking: boolean;

  // Actions
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  toggleMute: () => Promise<void>;
}

export function useVoiceCall(
  config: VoiceCallConfig | null,
  onTranscript?: (transcript: ChatMessage) => void
): UseVoiceCallReturn {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isAgentSpeaking, setIsAgentSpeaking] = useState(false);

  const roomRef = useRef<Room | null>(null);
  const audioElementsRef = useRef<HTMLAudioElement[]>([]);

  // Handle incoming audio tracks from agent
  const handleTrackSubscribed = useCallback(
    (
      track: RemoteTrack,
      _publication: RemoteTrackPublication,
      _participant: RemoteParticipant
    ) => {
      if (track.kind === Track.Kind.Audio) {
        console.log("Agent audio track subscribed");

        // Attach audio to play through speakers
        const audioElement = track.attach();
        audioElement.autoplay = true;
        audioElement.style.display = "none";
        document.body.appendChild(audioElement);
        audioElementsRef.current.push(audioElement);

        // Set agent as speaking when track is subscribed (simplified approach)
        setIsAgentSpeaking(true);

        // Reset when track ends
        track.on("ended", () => {
          console.log("Agent audio track ended");
          setIsAgentSpeaking(false);
        });
      }
    },
    []
  );

  // Save voice message to database via API
  // sessionId is the conversation ID - same for text and voice
  const saveVoiceMessage = useCallback(
    async (role: "user" | "assistant", content: string) => {
      // Get email from session storage
      const email = getUserEmail();

      // Skip if no email or email is "skipped"
      if (!email || email === "skipped") {
        return;
      }

      try {
        if (!config) return;

        const response = await fetch(`${config.apiUrl}/api/voice/message`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email,
            collegeId: config.collegeId,
            sessionId: config.sessionId, // sessionId IS the conversation ID
            role,
            content,
          }),
        });

        if (!response.ok) {
          console.error("Failed to save voice message:", await response.text());
        }
      } catch (err) {
        console.error("Error saving voice message:", err);
      }
    },
    [config]
  );

  // Handle transcripts from agent (sent via data channel)
  const handleDataReceived = useCallback(
    (payload: Uint8Array, _participant: RemoteParticipant | undefined) => {
      try {
        const decoder = new TextDecoder();
        const dataString = decoder.decode(payload);
        const data: TranscriptData = JSON.parse(dataString);

        console.log("Received data:", data);

        // Expecting format: { type: 'transcript', role: 'user' | 'agent', text: '...' }
        if (data.type === "transcript" && onTranscript) {
          // Convert 'agent' to 'assistant' for consistency with Vercel AI SDK
          const role = data.role === "agent" ? "assistant" : "user";

          // Create ChatMessage object
          const chatMessage: ChatMessage = {
            id: `voice-${data.timestamp || Date.now()}`,
            role,
            content: data.text,
            createdAt: data.timestamp ? new Date(data.timestamp) : new Date(),
            isVoice: true,
          };

          onTranscript(chatMessage);

          // Save voice message to database
          saveVoiceMessage(role, data.text);
        }
      } catch (err) {
        console.error("Error parsing data:", err);
      }
    },
    [onTranscript, saveVoiceMessage]
  );

  // Connect to LiveKit room
  const connect = useCallback(async () => {
    if (!config) return;

    // Always disconnect existing room before connecting to ensure clean state
    if (roomRef.current) {
      console.log("Cleaning up existing room before reconnecting...");
      await disconnect();
    }

    setIsConnecting(true);
    setError(null);

    try {
      // Step 1: Get access token from Express.js
      console.log("Requesting access token...");

      // Convert chatHistory to simple format for agent
      const formattedHistory =
        config.chatHistory?.map((msg) => ({
          role: msg.role,
          content: msg.content,
        })) || [];

      // Get email from session storage
      const email = getUserEmail();

      const response = await fetch(`${config.apiUrl}/api/voice/token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          collegeId: config.collegeId,
          sessionId: config.sessionId,
          chatHistory: formattedHistory,
          email: email && email !== "skipped" ? email : undefined, // Pass email for agent metadata
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to get access token");
      }

      const { token, wsUrl } = await response.json();
      console.log("Access token received, connecting to LiveKit...");

      // Step 2: Create LiveKit Room
      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
        audioCaptureDefaults: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      // Step 3: Set up event listeners
      room
        .on(RoomEvent.Connected, () => {
          console.log("✅ Connected to LiveKit room");
          setIsConnected(true);
          setIsConnecting(false);
        })
        .on(RoomEvent.Disconnected, (reason) => {
          console.log("Disconnected from room:", reason);
          setIsConnected(false);
          setIsAgentSpeaking(false);

          // Cleanup audio elements
          audioElementsRef.current.forEach((el) => {
            el.remove();
          });
          audioElementsRef.current = [];
        })
        .on(RoomEvent.TrackSubscribed, handleTrackSubscribed)
        .on(RoomEvent.DataReceived, handleDataReceived)
        .on(RoomEvent.AudioPlaybackStatusChanged, () => {
          if (!room.canPlaybackAudio) {
            console.log("Audio playback blocked by browser, starting audio...");
            room.startAudio().catch((err) => {
              console.error("Failed to start audio:", err);
            });
          }
        })
        .on(RoomEvent.Reconnecting, () => {
          console.log("Reconnecting to LiveKit...");
        })
        .on(RoomEvent.Reconnected, () => {
          console.log("Reconnected to LiveKit");
        });

      // Step 4: Connect to LiveKit Cloud
      await room.connect(wsUrl, token);

      // Step 5: Enable microphone
      console.log("Enabling microphone...");
      await room.localParticipant.setMicrophoneEnabled(true);
      console.log("✅ Microphone enabled");

      roomRef.current = room;
    } catch (err) {
      console.error("Failed to connect:", err);
      setError(err instanceof Error ? err.message : "Connection failed");
      setIsConnecting(false);
      setIsConnected(false);
    }
  }, [config, handleTrackSubscribed, handleDataReceived]);

  // Disconnect from room
  const disconnect = useCallback(async () => {
    if (roomRef.current) {
      console.log("Disconnecting from LiveKit room...");

      // Disable microphone before disconnect
      try {
        await roomRef.current.localParticipant.setMicrophoneEnabled(false);
      } catch (err) {
        console.warn("Error disabling microphone:", err);
      }

      // Disconnect and cleanup
      await roomRef.current.disconnect();
      roomRef.current = null;

      // Reset all state
      setIsConnected(false);
      setIsConnecting(false);
      setIsAgentSpeaking(false);
      setIsMuted(false);
      setError(null);

      // Cleanup audio elements
      audioElementsRef.current.forEach((el) => {
        el.remove();
      });
      audioElementsRef.current = [];

      console.log("✅ Room disconnected and cleaned up");
    }
  }, []);

  // Toggle microphone mute
  const toggleMute = useCallback(async () => {
    if (roomRef.current) {
      const newMutedState = !isMuted;
      await roomRef.current.localParticipant.setMicrophoneEnabled(
        !newMutedState
      );
      setIsMuted(newMutedState);
      console.log(`Microphone ${newMutedState ? "muted" : "unmuted"}`);
    }
  }, [isMuted]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    isConnecting,
    isConnected,
    error,
    isMuted,
    isAgentSpeaking,
    connect,
    disconnect,
    toggleMute,
  };
}
