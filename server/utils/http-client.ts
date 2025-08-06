/**
 * Makes an API request with consistent error handling
 * @param url The URL to fetch
 * @param providerName The name of the API provider for error messages
 * @returns The parsed JSON response
 * @throws Error if the request fails or returns a non-OK status
 */
export const makeApiRequest = async (url: string, providerName: string): Promise<any> => {
  const response = await fetch(url, {
    headers: {
      "Accept": "application/json",
    },
  })

  if (!response.ok) {
    const errorMessage = `${providerName} API error: ${response.status} ${response.statusText}`
    console.error(errorMessage)
    throw new Error(errorMessage)
  }

  return response.json()
}

/**
 * Makes an API request with custom headers
 * @param url The URL to fetch
 * @param providerName The name of the API provider for error messages
 * @param headers Custom headers to include in the request
 * @returns The parsed JSON response
 * @throws Error if the request fails or returns a non-OK status
 */
export const makeApiRequestWithHeaders = async (
  url: string, 
  providerName: string, 
  headers: Record<string, string>
): Promise<any> => {
  const response = await fetch(url, {
    headers: {
      "Accept": "application/json",
      ...headers,
    },
  })

  if (!response.ok) {
    const errorMessage = `${providerName} API error: ${response.status} ${response.statusText}`
    console.error(errorMessage)
    throw new Error(errorMessage)
  }

  return response.json()
} 