/**
 * Vercel Serverless Function for Widget Security Check
 * Endpoint: /api/validate-domain
 * This validates if a domain is allowed to use the widget
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";

// Allowed domains configuration
// This should match the ALLOWED_DOMAINS in src/lib/allowed-domains.ts
const ALLOWED_DOMAINS = [
  {
    domain: "localhost",
    collegeIds: ["*"],
  },
  {
    domain: "127.0.0.1",
    collegeIds: ["*"],
  },
  // Add production domains here
  // {
  //   domain: "delhipolytechnic.edu.in",
  //   collegeIds: ["delhi-polytechnic"],
  // },
];

export default function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST requests
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { referrer, collegeId } = req.body;

  if (!referrer || !collegeId) {
    return res.status(400).json({ error: "Missing referrer or collegeId" });
  }

  try {
    const url = new URL(referrer);
    const hostname = url.hostname;

    // Check if domain is allowed
    for (const allowedDomain of ALLOWED_DOMAINS) {
      if (
        hostname === allowedDomain.domain ||
        hostname.endsWith(`.${allowedDomain.domain}`)
      ) {
        // Check college ID authorization
        if (
          allowedDomain.collegeIds.includes("*") ||
          allowedDomain.collegeIds.includes(collegeId)
        ) {
          return res.status(200).json({
            allowed: true,
            message: "Domain authorized",
          });
        } else {
          return res.status(403).json({
            allowed: false,
            reason: `College ID '${collegeId}' not authorized for domain '${hostname}'`,
          });
        }
      }
    }

    // Domain not in allowlist
    return res.status(403).json({
      allowed: false,
      reason: `Domain '${hostname}' is not authorized`,
    });
  } catch (error) {
    return res.status(400).json({
      allowed: false,
      reason: "Invalid referrer URL",
    });
  }
}
