/**
 * CUID utility constants and helper functions
 */

/**
 * Regular expression pattern for UUIDs
 * Ensures that route parameters that should be UUIDs are exactly 36 characters
 * consisting of lowercase letters and numbers
 */
//export const UUID_PATTERN = '[a-z-0-9]{36}';

//export const UUID_PATTERN = '\[a-z-0-9\]\{36\}';

export const UUID_PATTERN = '[0-9a-f]{8}\-[0-9a-f]{4}\-[0-9a-f]{4}\-[0-9a-f]{4}\-[0-9a-f]{12}';

/**
 * RegExp object for validating UUIDs
 * Can be used for testing if a string is a valid UUID
 */
export const UUID_REGEX = new RegExp(`^${UUID_PATTERN}$`);

/**
 * Generate a route parameter pattern with CUID validation
 * 
 * @param paramName - The name of the route parameter (e.g., 'id', 'rosterId')
 * @returns A string in the format ':paramName(cuidPattern)' for use in Express routes
 * 
 * @example
 * // Returns ':id([a-z0-9]{24})'
 * const idParam = uuidRouteParam('id');
 * 
 * // Use in Express route:
 * app.get(`/api/resource/${uuidRouteParam('id')}`, handler);
 */
export function uuidRouteParam(paramName: string): string {
  //return `:${paramName}(${UUID_PATTERN})`;
  return `(?<${paramName}>[0-9a-f]{8}\-[0-9a-f]{4}\-[0-9a-f]{4}\-[0-9a-f]{4}\-[0-9a-f]{12})`;
}

export function regExpPath(path: string): RegExp {
  return new RegExp(`^${path}$`);
}
