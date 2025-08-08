/**
 * Makes an API request with consistent error handling
 * @param url The URL to fetch
 * @param providerName The name of the API provider for error messages
 * @returns The parsed JSON response
 * @throws Error if the request fails or returns a non-OK status
 */
export const makeApiRequest = async (url: string, providerName: string): Promise<any> => {
  console.log("url", url)
  const response = await fetch(url, {
    headers: {
      "Accept": "application/json",
    },
  })

  if (!response.ok) {
    try {
      const errorBody = await response.text()
      console.error("EROROROR : ", errorBody)
    } catch (error) {
      console.error("EROROROR : ", error)
    }
    console.log("STATUS", response.status)
    console.log("STATUS TEXT", response.statusText)
    const errorMessage = `${providerName} API error: ${response.status} ${response.statusText}`
    console.error("EROROROR : ", errorMessage)
    console.error("EROROROR : ", errorMessage)
    throw new Error(errorMessage)
  }

  return response.json()
}