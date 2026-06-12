import type Anthropic from "@anthropic-ai/sdk";

/**
 * Provider identifiers for {@link LlmModelRef}. Extend when adding adapters (e.g. bedrock, ollama).
 */
export type LlmProviderId = "anthropic";

/**
 * Logical model selection for {@link LlmGateway}. Implementors map this to provider-specific IDs.
 */
export type LlmModelRef = {
  provider: LlmProviderId;
  /** Provider-native model id; omit to use env default for that provider. */
  modelId?: string;
};

/** Per-request options (e.g. cooperative cancel for distributed workers). */
export type LlmRequestOptions = {
  signal?: AbortSignal;
};

/**
 * Minimal contract for non-streaming chat completions used by OCR and future features.
 * Params stay Anthropic-shaped for now; additional providers add adapters that accept or map from this shape.
 */
export interface LlmGateway {
  createNonStreamingMessage(
    params: Anthropic.MessageCreateParamsNonStreaming,
    options?: LlmRequestOptions
  ): Promise<Anthropic.Message>;
}

/**
 * Invokes {@link LlmGateway.createNonStreamingMessage} with an optional `AbortSignal`.
 * When the signal has aborted, failures are normalized to `DOMException` / `AbortError`
 * so OCR / process handlers can treat shutdown the same as local `throwIfAborted()`.
 */
export async function createNonStreamingMessageWithAbort(
  llm: LlmGateway,
  params: Anthropic.MessageCreateParamsNonStreaming,
  signal: AbortSignal | undefined
): Promise<Anthropic.Message> {
  try {
    return await llm.createNonStreamingMessage(
      params,
      signal ? { signal } : undefined
    );
  } catch (err) {
    if (signal?.aborted) {
      throw new DOMException(
        typeof signal.reason === "string" && signal.reason.length > 0
          ? signal.reason
          : "Aborted",
        "AbortError"
      );
    }
    throw err;
  }
}
