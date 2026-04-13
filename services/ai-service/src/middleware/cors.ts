import cors from "cors";
import { logger } from "../lib/utils/logger.js";

const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(",") || ["*"];

export const corsMiddleware = cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) {
      return callback(null, true);
    }

    // Allow all origins in development or if * is specified
    if (
      allowedOrigins.includes("*") ||
      process.env.NODE_ENV === "development"
    ) {
      return callback(null, true);
    }

    // Check if origin is in allowed list
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    logger.warn(`CORS blocked request from origin: ${origin}`);
    callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
});
