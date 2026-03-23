/**
 * LLM invocation using OpenAI, Grok, Gemini, or Claude APIs.
 * Uses OpenAI-compatible API format for all providers.
 *
 * Supports:
 *   - Multi-provider fallback (OpenAI -> Grok -> Gemini -> Claude)
 *   - Vision (image analysis via multimodal models)
 *   - JSON mode / structured output
 *   - Tool calling
 */
import { ENV } from "./env";

export type Role = "system" | "user" | "assistant" | "tool" | "function";

export type TextContent = {
  type: "text";
  text: string;
};

export type ImageContent = {
  type: "image_url";
  image_url: {
    url: string;
    detail?: "auto" | "low" | "high";
  };
};

export type FileContent = {
  type: "file_url";
  file_url: {
    url: string;
    mime_type?: "audio/mpeg" | "audio/wav" | "application/pdf" | "audio/mp4" | "video/mp4";
  };
};

export type MessageContent = string | TextContent | ImageContent | FileContent;

export type Message = {
  role: Role;
  content: MessageContent | MessageContent[];
  name?: string;
  tool_call_id?: string;
};

export type Tool = {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
};

export type ToolChoicePrimitive = "none" | "auto" | "required";
export type ToolChoiceByName = { name: string };
export type ToolChoiceExplicit = {
  type: "function";
  function: { name: string };
};

export type ToolChoice =
  | ToolChoicePrimitive
  | ToolChoiceByName
  | ToolChoiceExplicit;

export type InvokeParams = {
  messages: Message[];
  tools?: Tool[];
  toolChoice?: ToolChoice;
  tool_choice?: ToolChoice;
  maxTokens?: number;
  max_tokens?: number;
  outputSchema?: OutputSchema;
  output_schema?: OutputSchema;
  responseFormat?: ResponseFormat;
  response_format?: ResponseFormat;
  provider?: "openai" | "anthropic" | "gemini" | "grok";
  /** When true, automatically falls back to next provider on failure. Default: false. */
  autoFallback?: boolean;
  /** Temperature for generation (0-2). Default: provider default. */
  temperature?: number;
};

export type ToolCall = {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
};

export type InvokeResult = {
  id: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: Role;
      content: string | Array<TextContent | ImageContent | FileContent>;
      tool_calls?: ToolCall[];
    };
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
};

export type JsonSchema = {
  name: string;
  schema: Record<string, unknown>;
  strict?: boolean;
};

export type OutputSchema = JsonSchema;

export type ResponseFormat =
  | { type: "text" }
  | { type: "json_object" }
  | { type: "json_schema"; json_schema: JsonSchema };

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ensureArray = (value: MessageContent | MessageContent[]): MessageContent[] =>
  Array.isArray(value) ? value : [value];

const normalizeContentPart = (part: MessageContent): TextContent | ImageContent | FileContent => {
  if (typeof part === "string") return { type: "text", text: part };
  if (part.type === "text" || part.type === "image_url" || part.type === "file_url") return part;
  throw new Error("Unsupported message content part");
};

const normalizeMessage = (message: Message) => {
  const { role, name, tool_call_id } = message;

  if (role === "tool" || role === "function") {
    const content = ensureArray(message.content)
      .map(part => (typeof part === "string" ? part : JSON.stringify(part)))
      .join("\n");
    return { role, name, tool_call_id, content };
  }

  const contentParts = ensureArray(message.content).map(normalizeContentPart);
  if (contentParts.length === 1 && contentParts[0].type === "text") {
    return { role, name, content: contentParts[0].text };
  }
  return { role, name, content: contentParts };
};

const normalizeToolChoice = (
  toolChoice: ToolChoice | undefined,
  tools: Tool[] | undefined,
): "none" | "auto" | ToolChoiceExplicit | undefined => {
  if (!toolChoice) return undefined;
  if (toolChoice === "none" || toolChoice === "auto") return toolChoice;
  if (toolChoice === "required") {
    if (!tools || tools.length === 0) throw new Error("tool_choice 'required' but no tools configured");
    if (tools.length > 1) throw new Error("tool_choice 'required' needs a single tool or explicit name");
    return { type: "function", function: { name: tools[0].function.name } };
  }
  if ("name" in toolChoice) return { type: "function", function: { name: toolChoice.name } };
  return toolChoice;
};

const normalizeResponseFormat = (params: {
  responseFormat?: ResponseFormat;
  response_format?: ResponseFormat;
  outputSchema?: OutputSchema;
  output_schema?: OutputSchema;
}) => {
  const fmt = params.responseFormat || params.response_format;
  if (fmt) return fmt;
  const schema = params.outputSchema || params.output_schema;
  if (!schema) return undefined;
  return { type: "json_schema" as const, json_schema: schema };
};

// ─── Provider Config ──────────────────────────────────────────────────────────

type ProviderConfig = {
  name: string;
  url: string;
  key: string;
  model: string;
};

const PROVIDER_DEFINITIONS: Array<{
  name: string;
  config: () => ProviderConfig | null;
}> = [
  {
    name: "openai",
    config: () =>
      ENV.openaiApiKey
        ? {
            name: "openai",
            url: "https://api.openai.com/v1/chat/completions",
            key: ENV.openaiApiKey,
            model: "gpt-4o-mini",
          }
        : null,
  },
  {
    name: "grok",
    config: () =>
      ENV.grokApiKey
        ? {
            name: "grok",
            url: "https://api.x.ai/v1/chat/completions",
            key: ENV.grokApiKey,
            model: "grok-3-mini-fast",
          }
        : null,
  },
  {
    name: "gemini",
    config: () =>
      ENV.geminiApiKey
        ? {
            name: "gemini",
            url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
            key: ENV.geminiApiKey,
            model: "gemini-2.0-flash",
          }
        : null,
  },
  {
    name: "anthropic",
    config: () =>
      ENV.anthropicApiKey
        ? {
            name: "anthropic",
            url: "https://api.anthropic.com/v1/messages",
            key: ENV.anthropicApiKey,
            model: "claude-sonnet-4-20250514",
          }
        : null,
  },
];

function resolveProvider(preferred?: string): ProviderConfig {
  // If preferred, try that first
  if (preferred) {
    const p = PROVIDER_DEFINITIONS.find((p) => p.name === preferred);
    if (p) {
      const config = p.config();
      if (config) return config;
    }
  }

  // Fall through to first available
  for (const p of PROVIDER_DEFINITIONS) {
    const config = p.config();
    if (config) return config;
  }

  throw new Error(
    "No LLM API key configured. Set OPENAI_API_KEY, GROK_API_KEY, GEMINI_API_KEY, or ANTHROPIC_API_KEY.",
  );
}

/** Get all available providers in fallback order, optionally starting after a given provider. */
function getAvailableProviders(afterProvider?: string): ProviderConfig[] {
  const configs: ProviderConfig[] = [];
  let started = !afterProvider;

  for (const p of PROVIDER_DEFINITIONS) {
    if (!started) {
      if (p.name === afterProvider) started = true;
      continue;
    }
    const config = p.config();
    if (config) configs.push(config);
  }

  return configs;
}

// ─── Main Function ────────────────────────────────────────────────────────────

/**
 * Invoke an LLM with full support for vision, tools, structured output, and
 * multi-provider fallback.
 */
export async function invokeLLM(params: InvokeParams): Promise<InvokeResult> {
  const provider = resolveProvider(params.provider);

  try {
    return await callProvider(provider, params);
  } catch (err: any) {
    // If autoFallback is enabled (or no explicit provider was requested),
    // try remaining providers
    if (params.autoFallback || !params.provider) {
      const fallbacks = getAvailableProviders(provider.name);
      for (const fallback of fallbacks) {
        try {
          console.warn(
            `[LLM] ${provider.name} failed (${err.message}), trying ${fallback.name}...`,
          );
          return await callProvider(fallback, params);
        } catch (fallbackErr: any) {
          console.warn(`[LLM] ${fallback.name} also failed: ${fallbackErr.message}`);
        }
      }
    }

    throw err;
  }
}

/** Build and send the request to a specific provider. */
async function callProvider(
  provider: ProviderConfig,
  params: InvokeParams,
): Promise<InvokeResult> {
  const payload: Record<string, unknown> = {
    model: provider.model,
    messages: params.messages.map(normalizeMessage),
    max_tokens: params.maxTokens || params.max_tokens || 4096,
  };

  if (params.temperature !== undefined) {
    payload.temperature = params.temperature;
  }

  if (params.tools && params.tools.length > 0) {
    payload.tools = params.tools;
  }

  const normalizedToolChoice = normalizeToolChoice(
    params.toolChoice || params.tool_choice,
    params.tools,
  );
  if (normalizedToolChoice) {
    payload.tool_choice = normalizedToolChoice;
  }

  const normalizedResponseFormat = normalizeResponseFormat(params);
  if (normalizedResponseFormat) {
    payload.response_format = normalizedResponseFormat;
  }

  const response = await fetch(provider.url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${provider.key}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `LLM invoke failed (${provider.model}): ${response.status} ${response.statusText} – ${errorText}`,
    );
  }

  return (await response.json()) as InvokeResult;
}

// ─── Vision Helper ────────────────────────────────────────────────────────────

/**
 * Convenience function for vision tasks — sends an image to an LLM for analysis.
 * Used by multiple tools that need image understanding.
 *
 * @param prompt - The analysis instruction
 * @param imageUrl - URL of the image to analyze (can be a public URL or data URI)
 * @param options - Additional options (provider, maxTokens, JSON mode)
 * @returns The text response from the LLM
 */
export async function invokeLLMWithVision(
  prompt: string,
  imageUrl: string,
  options?: {
    provider?: InvokeParams["provider"];
    maxTokens?: number;
    jsonMode?: boolean;
    systemPrompt?: string;
    detail?: "auto" | "low" | "high";
  },
): Promise<string> {
  const messages: Message[] = [];

  if (options?.systemPrompt) {
    messages.push({ role: "system", content: options.systemPrompt });
  }

  messages.push({
    role: "user",
    content: [
      { type: "text", text: prompt },
      {
        type: "image_url",
        image_url: {
          url: imageUrl,
          detail: options?.detail ?? "auto",
        },
      },
    ],
  });

  const invokeParams: InvokeParams = {
    messages,
    maxTokens: options?.maxTokens ?? 1024,
    provider: options?.provider,
    autoFallback: true,
  };

  if (options?.jsonMode) {
    invokeParams.responseFormat = { type: "json_object" };
  }

  const result = await invokeLLM(invokeParams);
  const content = result.choices[0]?.message?.content;

  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    // Extract text parts from multimodal response
    return content
      .filter((part): part is TextContent => part.type === "text")
      .map((part) => part.text)
      .join("\n");
  }

  return "";
}

// ─── JSON Helper ──────────────────────────────────────────────────────────────

/**
 * Invoke an LLM and parse the response as JSON.
 * Automatically sets json_object response format.
 *
 * @param prompt - The prompt that should produce JSON output
 * @param options - Provider, maxTokens, schema, etc.
 * @returns Parsed JSON object
 */
export async function invokeLLMJSON<T = Record<string, unknown>>(
  prompt: string,
  options?: {
    provider?: InvokeParams["provider"];
    maxTokens?: number;
    systemPrompt?: string;
    schema?: OutputSchema;
  },
): Promise<T> {
  const messages: Message[] = [];

  if (options?.systemPrompt) {
    messages.push({ role: "system", content: options.systemPrompt });
  } else {
    messages.push({
      role: "system",
      content: "You are a helpful assistant. Always respond with valid JSON only, no markdown formatting.",
    });
  }

  messages.push({ role: "user", content: prompt });

  const invokeParams: InvokeParams = {
    messages,
    maxTokens: options?.maxTokens ?? 2048,
    provider: options?.provider,
    autoFallback: true,
  };

  if (options?.schema) {
    invokeParams.responseFormat = {
      type: "json_schema",
      json_schema: options.schema,
    };
  } else {
    invokeParams.responseFormat = { type: "json_object" };
  }

  const result = await invokeLLM(invokeParams);
  const content = result.choices[0]?.message?.content;
  const text = typeof content === "string" ? content : "";

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`LLM returned invalid JSON: ${text.slice(0, 200)}`);
  }
}
