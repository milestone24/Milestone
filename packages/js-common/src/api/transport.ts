async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export interface ApiTransport {
  request<T>(method: string, url: string, data?: unknown): Promise<T>;
}

let apiTransport: ApiTransport | null = null;

export function configureApiTransport(transport: ApiTransport): void {
  apiTransport = transport;
}

export function getApiTransport(): ApiTransport {
  if (!apiTransport) {
    throw new Error(
      "ApiTransport is not configured. Call configureApiTransport before using apiRequest."
    );
  }
  return apiTransport;
}

export async function apiRequest<T>(
  method: string,
  url: string,
  data?: unknown
): Promise<T> {
  return getApiTransport().request<T>(method, url, data);
}

export async function defaultFetchApiRequest<T>(
  method: string,
  url: string,
  data?: unknown,
  options?: { baseUrl?: string; credentials?: RequestCredentials }
): Promise<T> {
  const baseUrl = options?.baseUrl ?? "";
  const resolvedUrl = url.startsWith("http") ? url : `${baseUrl}${url}`;

  const res = await fetch(resolvedUrl, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: options?.credentials ?? "include",
  });

  await throwIfResNotOk(res);
  if (res.status === 204) {
    return undefined as T;
  }

  try {
    return (await res.json()) as T;
  } catch (error) {
    console.error(error);
    throw error;
  }
}
