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

/**
 * Minimal contract for non-streaming chat completions used by OCR and future features.
 * Params stay Anthropic-shaped for now; additional providers add adapters that accept or map from this shape.
 */
export interface LlmGateway {
  createNonStreamingMessage(
    params: Anthropic.MessageCreateParamsNonStreaming
  ): Promise<Anthropic.Message>;
}
