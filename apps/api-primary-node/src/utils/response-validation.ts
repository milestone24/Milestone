/**
 * Validates that an API response is an array
 * @param data The response data to validate
 * @param context Context for error messages
 * @returns The validated array or empty array if invalid
 */
export const validateArrayResponse = <T>(data: any, context: string): T[] => {
  if (!Array.isArray(data)) {
    console.error(`${context} returned unexpected data format`)
    return []
  }
  return data
}

/**
 * Validates that an API response is an object
 * @param data The response data to validate
 * @param context Context for error messages
 * @returns The validated object or null if invalid
 */
export const validateObjectResponse = <T>(data: any, context: string): T | null => {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    console.error(`${context} returned unexpected data format`)
    return null
  }
  return data
}

/**
 * Validates that a required field exists in an object
 * @param obj The object to check
 * @param field The field name to validate
 * @param context Context for error messages
 * @returns True if the field exists and has a value
 */
export const validateRequiredField = (obj: any, field: string, context: string): boolean => {
  if (!obj || typeof obj !== 'object' || !(field in obj) || obj[field] === undefined || obj[field] === null) {
    console.error(`${context} missing required field: ${field}`)
    return false
  }
  return true
} 