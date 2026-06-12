/**
 * Wraps an async operation with consistent error handling
 * @param operation The async operation to execute
 * @param errorContext Context for error messages
 * @param fallbackValue Optional fallback value to return on error
 * @returns The result of the operation or fallback value
 * @throws Error if operation fails and no fallback is provided
 */
export const withErrorHandling = async <T>(
  operation: () => Promise<T>,
  errorContext: string,
  fallbackValue?: T
): Promise<T> => {
  try {
    return await operation()
  } catch (error) {
    console.error(`Error in ${errorContext}:`, error)
    if (fallbackValue !== undefined) {
      return fallbackValue
    }
    throw error
  }
}

/**
 * Wraps a sync operation with consistent error handling
 * @param operation The sync operation to execute
 * @param errorContext Context for error messages
 * @param fallbackValue Optional fallback value to return on error
 * @returns The result of the operation or fallback value
 * @throws Error if operation fails and no fallback is provided
 */
export const withErrorHandlingSync = <T>(
  operation: () => T,
  errorContext: string,
  fallbackValue?: T
): T => {
  try {
    return operation()
  } catch (error) {
    console.error(`Error in ${errorContext}:`, error)
    if (fallbackValue !== undefined) {
      return fallbackValue
    }
    throw error
  }
} 