import express, { Request, Response } from "express";
import dotenv from "dotenv";
import { corsMiddleware } from "./middleware/cors.js";
import { chatRouter } from "./routes/chat.js";
import voiceRouter from "./routes/voice.js";
import { userRouter } from "./routes/user.js";
import { ragRouter } from "./routes/rag.js";
import { logger } from "./lib/utils/logger.js";
import { HealthCheckResponse } from "./types/index.js";

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(corsMiddleware);
app.use(express.json());

// Health check endpoint
app.get("/health", (_req: Request, res: Response) => {
  const response: HealthCheckResponse = {
    status: "ok",
    timestamp: new Date().toISOString(),
    service: "text-chatbot",
  };
  res.json(response);
});

// API routes
app.use("/api", chatRouter);
app.use("/api/voice", voiceRouter);
app.use("/api/user", userRouter);
app.use("/api/rag", ragRouter);

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: "Not Found",
    message: `Route ${req.method} ${req.path} not found`,
    statusCode: 404,
  });
});

// Error handler
app.use((err: Error, _req: Request, res: Response, _next: any) => {
  logger.error("Unhandled error:", err);

  if (!res.headersSent) {
    res.status(500).json({
      error: "Internal Server Error",
      message:
        process.env.NODE_ENV === "development"
          ? err.message
          : "Something went wrong",
      statusCode: 500,
    });
  }
});

// Start server
app.listen(PORT, () => {
  logger.info(`🚀 Text Chatbot API server running on port ${PORT}`);
  logger.info(`📊 Health check: http://localhost:${PORT}/health`);
  logger.info(`💬 Chat endpoint: http://localhost:${PORT}/api/chat`);
  logger.info(`🎤 Voice token: http://localhost:${PORT}/api/voice/token`);
  logger.info(`👤 User identify: http://localhost:${PORT}/api/user/identify`);
  logger.info(`🌍 Environment: ${process.env.NODE_ENV || "development"}`);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  logger.info("SIGTERM signal received: closing HTTP server");
  process.exit(0);
});

process.on("SIGINT", () => {
  logger.info("SIGINT signal received: closing HTTP server");
  process.exit(0);
});
