/**
 * User routes for email-based authentication
 */

import { Router, Request, Response } from "express";
import { getSupabase } from "../lib/rag/supabase.js";
import { logger } from "../lib/utils/logger.js";
import { IdentifyUserRequest, IdentifyUserResponse } from "../types/index.js";

export const userRouter = Router();

/**
 * POST /api/user/identify
 * Lookup or create a user by email and college_id
 * Returns user ID and whether the user is new
 */
userRouter.post(
  "/identify",
  async (
    req: Request<{}, IdentifyUserResponse, IdentifyUserRequest>,
    res: Response
  ) => {
    try {
      const { email, collegeId } = req.body;

      // Validate request
      if (!email || typeof email !== "string") {
        res.status(400).json({
          error: "Bad Request",
          message: "Email is required",
          statusCode: 400,
        });
        return;
      }

      if (!collegeId || typeof collegeId !== "string") {
        res.status(400).json({
          error: "Bad Request",
          message: "College ID is required",
          statusCode: 400,
        });
        return;
      }

      // Basic email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        res.status(400).json({
          error: "Bad Request",
          message: "Invalid email format",
          statusCode: 400,
        });
        return;
      }

      const normalizedEmail = email.toLowerCase().trim();

      logger.info("User identify request", {
        email: normalizedEmail,
        collegeId,
      });

      const supabase = getSupabase();

      // Try to find existing user
      const { data: existingUser, error: findError } = await supabase
        .from("users")
        .select("*")
        .eq("email", normalizedEmail)
        .eq("college_id", collegeId)
        .single();

      if (findError && findError.code !== "PGRST116") {
        // PGRST116 = no rows returned
        logger.error("Error finding user:", findError);
        throw findError;
      }

      if (existingUser) {
        // Update last_active_at
        await supabase
          .from("users")
          .update({ last_active_at: new Date().toISOString() })
          .eq("id", existingUser.id);

        logger.info("Existing user found", { userId: existingUser.id });

        const response: IdentifyUserResponse = {
          userId: existingUser.id,
          isNew: false,
        };
        res.json(response);
        return;
      }

      // Create new user
      const { data: newUser, error: createError } = await supabase
        .from("users")
        .insert({
          email: normalizedEmail,
          college_id: collegeId,
        })
        .select()
        .single();

      if (createError) {
        logger.error("Error creating user:", createError);
        throw createError;
      }

      logger.info("New user created", { userId: newUser.id });

      const response: IdentifyUserResponse = {
        userId: newUser.id,
        isNew: true,
      };
      res.json(response);
    } catch (error) {
      logger.error("User identify error:", error);

      if (!res.headersSent) {
        res.status(500).json({
          error: "Internal Server Error",
          message:
            error instanceof Error ? error.message : "Unknown error occurred",
          statusCode: 500,
        });
      }
    }
  }
);
