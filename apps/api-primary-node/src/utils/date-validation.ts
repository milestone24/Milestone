/**
 * Validates a Date object and extracts the date string in YYYY-MM-DD format
 * @param date The Date object to validate
 * @returns The date string in YYYY-MM-DD format
 * @throws Error if the date is invalid or cannot be converted
 */
export const validateAndExtractDateString = (date: Date): string => {
  try {
    const isoString = date.toISOString()
    const parts = isoString.split('T')
    if (parts.length < 1 || !parts[0]) {
      throw new Error("Invalid date format - could not extract date string")
    }
    return parts[0]
  } catch (error) {
    throw new Error("Invalid date format - could not extract date string")
  }
}

/**
 * Validates two Date objects and extracts date strings for a date range
 * @param startDate The start date
 * @param endDate The end date
 * @returns Object containing startDateStr and endDateStr in YYYY-MM-DD format
 * @throws Error if either date is invalid or cannot be converted
 */
export const validateAndExtractDateRange = (startDate: Date, endDate: Date): { startDateStr: string, endDateStr: string } => {
  return {
    startDateStr: validateAndExtractDateString(startDate),
    endDateStr: validateAndExtractDateString(endDate)
  }
} 