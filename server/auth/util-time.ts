import ms from 'ms';

/**
 * Valid time units for JWT expiresIn option
 */
export type TimeUnit = 's' | 'm' | 'h' | 'd' | 'w' | 'y';

/**
 * Type guard to check if a string is a valid time unit
 */
export function isTimeUnit(value: string): value is TimeUnit {
  return ['s', 'm', 'h', 'd', 'w', 'y'].includes(value);
}

/**
 * Type guard to check if a string is a valid time value
 * Valid formats: "30d", "15m", "1h", "2w", "1y"
 */
export function isValidTimeValue(value: string): boolean {
  const match = value.match(/^(\d+)([smhdwy])$/);
  if (!match) return false;

  const [, number, unit] = match;
  return number && unit ? isTimeUnit(unit) && parseInt(number) > 0 : false;
}

/**
 * Parses a time value string into milliseconds
 * @throws {Error} If the time value is invalid
 */
export function parseTimeValue(value: string): number {
  if (!isValidTimeValue(value)) {
    throw new Error(
      `Invalid time value: ${value}. Expected format: "30d", "15m", "1h", "2w", "1y"`
    );
  }

  return ms(value as ms.StringValue);
}

/**
 * Validates and parses a time value from an environment variable
 * @param envVar The environment variable value
 * @param defaultValue The default value if envVar is not set
 * @returns The parsed time value in milliseconds
 * @throws {Error} If the time value is invalid
 */
export function parseTimeEnvVar(
  value: string | undefined,
  defaultValue: string
): number {
  if (!value) return parseTimeString(defaultValue);
  return parseTimeString(value);
}

export function parseTimeString(timeString: string): number {
  const match = timeString.match(/^(\d+)([smhd])$/);
  if (!match) {
    throw new Error(
      `Invalid time string format: ${timeString}. Expected format: <number><unit> where unit is s (seconds), m (minutes), h (hours), or d (days)`
    );
  }

  const [, amount, unit] = match;

  if (!amount || !unit) {
    throw new Error(
      `Invalid time string format: ${timeString}. Expected format: <number><unit> where unit is s (seconds), m (minutes), h (hours), or d (days)`
    );
  }

  const multipliers = {
    s: 1,
    m: 60,
    h: 3600,
    d: 86400,
  };

  return parseInt(amount) * multipliers[unit as keyof typeof multipliers];
}

/**
 * Converts a time value to cookie maxAge in milliseconds
 * @param timeValue The time value string (e.g., "30d", "15m")
 * @returns The maxAge in milliseconds for cookie options
 * @throws {Error} If the time value is invalid
 */
export function timeToCookieMaxAge(timeString: string): number {
  return parseTimeString(timeString) * 1000; // Convert to milliseconds for cookie maxAge
}

/**
 * Calculates a database expiry date from a time value
 * @param timeValue The time value string (e.g., "30d", "15m")
 * @returns The expiry date
 * @throws {Error} If the time value is invalid
 */
export function timeToExpiryDate(timeValue: string): Date {
  const milliseconds = parseTimeValue(timeValue);
  const expiryDate = new Date();
  expiryDate.setTime(expiryDate.getTime() + milliseconds);
  return expiryDate;
}

/**
 * Validates all authentication-related environment variables
 * @throws {Error} If any required environment variables are missing or invalid
 */
export function validateAuthEnvVars(): void {
  const errors: string[] = [];

  // Required variables
  if (!process.env.JWT_SECRET) {
    errors.push("JWT_SECRET: Required for signing access tokens");
  }

  if (!process.env.REFRESH_TOKEN_SECRET) {
    errors.push("REFRESH_TOKEN_SECRET: Required for signing refresh tokens");
  }

  // Optional variables with defaults
  const accessTokenExpiry = process.env.ACCESS_TOKEN_EXPIRY || "15m";
  const refreshTokenExpiry = process.env.REFRESH_TOKEN_EXPIRY || "30d";

  try {
    parseTimeString(accessTokenExpiry);
  } catch (error) {
    errors.push(`ACCESS_TOKEN_EXPIRY: ${error instanceof Error ? error.message : "Invalid time format"}`);
  }

  try {
    parseTimeString(refreshTokenExpiry);
  } catch (error) {
    errors.push(`REFRESH_TOKEN_EXPIRY: ${error instanceof Error ? error.message : "Invalid time format"}`);
  }

  // Optional COOKIE_DOMAIN - only validate if provided
  if (process.env.COOKIE_DOMAIN) {
    const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9](?:\.[a-zA-Z]{2,})+$/;
    if (!domainRegex.test(process.env.COOKIE_DOMAIN)) {
      errors.push("COOKIE_DOMAIN: Must be a valid domain name (e.g., 'example.com')");
    }
  }

  if (errors.length > 0) {
    throw new Error(`Invalid auth environment variables:\n${errors.join("\n")}`);
  }
} 
