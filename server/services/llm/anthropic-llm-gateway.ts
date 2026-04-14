import Anthropic from "@anthropic-ai/sdk";
import type {
  LlmGateway,
  LlmRequestOptions,
} from "@server/services/llm/llm-gateway";

/**
 * {@link LlmGateway} backed by `@anthropic-ai/sdk` (Messages API, non-streaming).
 */
export class AnthropicLlmGateway implements LlmGateway {
  private readonly client: Anthropic;

  constructor(apiKey: string | undefined = process.env.ANTHROPIC_API_KEY) {
    this.client = new Anthropic({ apiKey });
  }

  createNonStreamingMessage(
    params: Anthropic.MessageCreateParamsNonStreaming,
    options?: LlmRequestOptions
  ): Promise<Anthropic.Message> {
    return this.client.messages.create(
      { ...params, stream: false },
      { signal: options?.signal }
    );
  }
}

/**
 * Default production gateway for Anthropic until multi-provider routing is added (Spike 1).
 */
export function createDefaultAnthropicLlmGateway(): LlmGateway {
  return new AnthropicLlmGateway();
}
