/**
 * Validates that an API key exists in environment variables
 * @param keyName The environment variable name for the API key
 * @param providerName The name of the API provider for error messages
 * @returns The API key value
 * @throws Error if the API key is not configured
 */
export const validateApiKey = (keyName: string, providerName: string): string => {
  const apiKey = process.env[keyName]
  if (!apiKey) {
    console.warn(`${providerName} API key not found in environment variables`)
    throw new Error(`${providerName} API key not configured`)
  }
  return apiKey
}

/**
 * Validates that an API key exists in environment variables (optional version)
 * @param keyName The environment variable name for the API key
 * @param providerName The name of the API provider for warning messages
 * @returns The API key value or null if not found
 */
export const validateApiKeyOptional = (keyName: string, providerName: string): string | null => {
  const apiKey = process.env[keyName]
  if (!apiKey) {
    console.warn(`${providerName} API key not found in environment variables`)
  }
  return apiKey || null
} 