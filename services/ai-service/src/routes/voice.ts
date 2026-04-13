import { Router } from "express";
import { AccessToken } from "livekit-server-sdk";
import { getSupabase } from "../lib/rag/supabase.js";
import { encrypt } from "../lib/utils/encryption.js";
import { logger } from "../lib/utils/logger.js";

const router = Router();

/**
 * POST /api/voice/token
 * Generate LiveKit access token for voice room
 *
 * Request Body:
 * {
 *   "collegeId": "demo-college",
 *   "sessionId": "session_abc123",
 *   "participantName": "User" (optional)
 * }
 *
 * Response:
 * {
 *   "token": "eyJhbGc...",
 *   "wsUrl": "wss://your-project.livekit.cloud",
 *   "roomName": "demo-college-session_abc123"
 * }
 */
router.post("/token", async (req, res) => {
  try {
    const { collegeId, sessionId, participantName, chatHistory, email } =
      req.body;

    // Debug: Log received chat history
    console.log(
      `🔍 Received chatHistory: ${JSON.stringify(chatHistory || [])}`
    );
    console.log(`🔍 Chat history length: ${chatHistory?.length || 0}`);
    console.log(`🔍 Email: ${email || "not provided"}`);

    // Validate required fields
    if (!collegeId || !sessionId) {
      return res.status(400).json({
        error: "collegeId and sessionId are required",
      });
    }

    // Validate environment variables
    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    const livekitUrl = process.env.LIVEKIT_URL;

    if (!apiKey || !apiSecret || !livekitUrl) {
      console.error("Missing LiveKit credentials in environment variables");
      return res.status(500).json({
        error:
          "Server configuration error - LiveKit credentials not configured",
      });
    }

    // Construct room name (unique per college + session + timestamp)
    // Adding timestamp ensures a fresh room for each connection
    const timestamp = Date.now();
    const roomName = `${collegeId}-${sessionId}-${timestamp}`;

    // Create access token
    const at = new AccessToken(apiKey, apiSecret, {
      identity: `${sessionId}-${timestamp}`, // Unique participant identity with timestamp
      name: participantName || "User",
      metadata: JSON.stringify({
        collegeId,
        sessionId,
        email: email || null, // Pass email to agent for message persistence
        chatHistory: chatHistory || [], // Pass chat history to agent
      }),
      ttl: "1h", // Token expires in 1 hour
    });

    // Grant permissions
    at.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true, // User can send audio
      canSubscribe: true, // User can receive audio
      canPublishData: true, // User can send data (for transcripts)
    });

    // Generate JWT token
    const token = await at.toJwt();

    console.log(`Generated token for room: ${roomName}, session: ${sessionId}`);

    res.json({
      token,
      wsUrl: livekitUrl,
      roomName,
    });
  } catch (error) {
    console.error("Error generating voice token:", error);
    res.status(500).json({
      error: "Failed to generate access token",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * POST /api/voice/message
 * Save a voice transcript message to the database
 * sessionId is used directly as the conversation ID (same as text chat)
 *
 * Request Body:
 * {
 *   "email": "user@example.com",
 *   "collegeId": "demo-college",
 *   "sessionId": "session_abc123", // This IS the conversation ID
 *   "role": "user" | "assistant",
 *   "content": "Hello, how can I help?"
 * }
 */
router.post("/message", async (req, res) => {
  try {
    const { email, collegeId, sessionId, role, content } = req.body;

    // Validate required fields
    if (!collegeId || !sessionId || !role || !content) {
      return res.status(400).json({
        error: "collegeId, sessionId, role, and content are required",
      });
    }

    // Skip if no email (anonymous user)
    if (!email) {
      logger.info("Skipping voice message save - no email provided");
      return res.json({ success: true, saved: false, reason: "no email" });
    }

    const supabase = getSupabase();

    // Find user
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("id")
      .eq("email", email)
      .eq("college_id", collegeId)
      .single();

    if (userError || !user) {
      logger.error("Failed to find user for voice message", {
        email,
        collegeId,
        error: userError,
      });
      return res.status(404).json({ error: "User not found" });
    }

    // Ensure conversation exists (sessionId = conversationId)
    const { data: existingConv } = await supabase
      .from("conversations")
      .select("id")
      .eq("id", sessionId)
      .single();

    if (!existingConv) {
      // Create conversation with sessionId as the ID
      const { error: convError } = await supabase.from("conversations").insert({
        id: sessionId, // sessionId IS the conversation ID
        user_id: user.id,
        college_id: collegeId,
      });

      if (convError) {
        logger.error("Failed to create conversation", { error: convError });
        return res.status(500).json({ error: "Failed to create conversation" });
      }
    }

    // Encrypt the message content
    const { encrypted, iv, tag } = encrypt(content);

    // Save the message (sessionId = conversationId)
    const { error: msgError } = await supabase.from("messages").insert({
      conversation_id: sessionId,
      role: role === "assistant" ? "assistant" : "user",
      content_encrypted: encrypted,
      content_iv: iv,
      content_tag: tag,
      is_voice: true,
    });

    if (msgError) {
      logger.error("Failed to save voice message", { error: msgError });
      return res.status(500).json({ error: "Failed to save message" });
    }

    // Update conversation updated_at
    await supabase
      .from("conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", sessionId);

    logger.info("Voice message saved", { sessionId, role });
    res.json({ success: true, saved: true });
  } catch (error) {
    logger.error("Error saving voice message:", error);
    res.status(500).json({
      error: "Failed to save voice message",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

export default router;
