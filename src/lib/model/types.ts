export type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string | ContentPart[];
}

export interface ChatRequest {
  model: string;
  messages: ChatMessage[];
  maxTokens: number;
  /** false sends chat_template_kwargs.enable_thinking=false (measured: ~10x fewer tokens, valid JSON). */
  thinking: boolean;
  /** Background work only (the nightly watch). */
  flex?: boolean;
  logprobs?: boolean;
  /** "json_object" or a JSON schema for response_format: json_schema. Both are accepted by all three models once thinking is off. */
  json?: "json_object" | Record<string, unknown>;
  temperature?: number;
}

export interface TokenLogprob {
  token: string;
  logprob: number;
}

export interface Usage {
  tokensIn: number;
  tokensOut: number;
  cachedTokens: number;
}

export interface ChatResult {
  content: string;
  usage: Usage;
  logprobs?: TokenLogprob[];
}

/** The only surface the features depend on. Token Factory and test doubles implement it. */
export interface ChatClient {
  chat(req: ChatRequest): Promise<ChatResult>;
}

export type ModelErrorCode =
  | "no_key"
  | "provider_unavailable"
  | "rate_limited"
  | "model_error"
  | "model_unavailable"
  | "invalid_output"
  | "over_budget"
  | "models_disabled"
  | "bad_request";

export class ModelError extends Error {
  constructor(
    message: string,
    readonly code: ModelErrorCode,
    readonly status: number = 502,
    /** Tokens the provider billed before the call failed (an empty reply); the meter settles to these. */
    readonly usage?: Usage,
  ) {
    super(message);
    this.name = "ModelError";
  }
}
