/**
 * Allowed Domains Configuration
 * Defines which domains are permitted to embed the chatbot widget
 */

export interface AllowedDomain {
  domain: string;
  collegeIds: string[]; // Which college IDs are allowed for this domain
  description?: string;
}

/**
 * List of allowed domains
 * Add new domains here as colleges are onboarded
 */
export const ALLOWED_DOMAINS: AllowedDomain[] = [
  {
    domain: "localhost",
    collegeIds: ["*"], // Allow all college IDs in development
    description: "Local development",
  },
  {
    domain: "127.0.0.1",
    collegeIds: ["*"],
    description: "Local development",
  },
  // Production domains - Add college websites here
  // Example:
  // {
  //   domain: "delhipolytechnic.edu.in",
  //   collegeIds: ["delhi-polytechnic"],
  //   description: "Delhi Polytechnic Official Website",
  // },
  // {
  //   domain: "gppune.ac.in",
  //   collegeIds: ["government-polytechnic-pune"],
  //   description: "Government Polytechnic Pune",
  // },
];

/**
 * Check if a domain is allowed to embed the widget
 * @param referrer - The referring URL or domain
 * @param collegeId - The college ID being initialized
 * @returns true if allowed, false otherwise
 */
export function isDomainAllowed(
  referrer: string | null,
  collegeId: string
): { allowed: boolean; reason?: string } {
  // In development mode (no referrer), allow all
  if (!referrer) {
    console.warn(
      "[CollegeChatbot] No referrer detected - allowing in development mode"
    );
    return { allowed: true };
  }

  try {
    const url = new URL(referrer);
    const hostname = url.hostname;

    // Check if domain matches any allowed domain
    for (const allowedDomain of ALLOWED_DOMAINS) {
      // Check if hostname matches or is a subdomain
      if (
        hostname === allowedDomain.domain ||
        hostname.endsWith(`.${allowedDomain.domain}`)
      ) {
        // Check if college ID is allowed for this domain
        if (
          allowedDomain.collegeIds.includes("*") ||
          allowedDomain.collegeIds.includes(collegeId)
        ) {
          return { allowed: true };
        } else {
          return {
            allowed: false,
            reason: `College ID '${collegeId}' is not authorized for domain '${hostname}'`,
          };
        }
      }
    }

    return {
      allowed: false,
      reason: `Domain '${hostname}' is not authorized to embed this widget`,
    };
  } catch (error) {
    console.error("[CollegeChatbot] Error parsing referrer:", error);
    return {
      allowed: false,
      reason: "Invalid referrer URL",
    };
  }
}

/**
 * Get all allowed origins for CORS headers
 * @returns Array of allowed origin patterns
 */
export function getAllowedOrigins(): string[] {
  const origins: string[] = [];

  for (const allowedDomain of ALLOWED_DOMAINS) {
    // Add both http and https for each domain
    origins.push(`https://${allowedDomain.domain}`);
    origins.push(`http://${allowedDomain.domain}`);

    // Add wildcard subdomain support for production domains
    if (!allowedDomain.domain.includes("localhost")) {
      origins.push(`https://*.${allowedDomain.domain}`);
      origins.push(`http://*.${allowedDomain.domain}`);
    }
  }

  return origins;
}
