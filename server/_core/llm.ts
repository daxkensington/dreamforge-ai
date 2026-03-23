/**
 * LLM invocation using OpenAI, Claude, or Gemini APIs.
 * Uses OpenAI-compatible API format for all providers.
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
  tools: Tool[] | undefined
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

type ProviderConfig = { url: string; key: string; model: string };

function resolveProvider(preferred?: string): ProviderConfig {
  // Try preferred provider first, then fall through to available ones
  const providers: Array<{ name: string; config: () => ProviderConfig | null }> = [
    {
      name: "openai",
      config: () => ENV.openaiApiKey ? {
        url: "https://api.openai.com/v1/chat/completions",
        key: ENV.openaiApiKey,
        model: "gpt-4o-mini",
      } : null,
    },
    {
      name: "grok",
      config: () => ENV.grokApiKey ? {
        url: "https://api.x.ai/v1/chat/completions",
        key: ENV.grokApiKey,
        model: "grok-3-mini-fast",
      } : null,
    },
    {
      name: "gemini",
      config: () => ENV.geminiApiKey ? {
        url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
        key: ENV.geminiApiKey,
        model: "gemini-2.0-flash",
      } : null,
    },
    {
      name: "anthropic",
      config: () => ENV.anthropicApiKey ? {
        url: "https://api.anthropic.com/v1/messages",
        key: ENV.anthropicApiKey,
        model: "claude-sonnet-4-20250514",
      } : null,
    },
  ];

  // If preferred, try that first
  if (preferred) {
    const p = providers.find(p => p.name === preferred);
    if (p) {
      const config = p.config();
      if (config) return config;
    }
  }

  // Fall through to first available
  for (const p of providers) {
    const config = p.config();
    if (config) return config;
  }

  throw new Error("No LLM API key configured. Set OPENAI_API_KEY, GROK_API_KEY, GEMINI_API_KEY, or ANTHROPIC_API_KEY.");
}

// ─── Main Function ────────────────────────────────────────────────────────────

export async function invokeLLM(params: InvokeParams): Promise<InvokeResult> {
  const provider = resolveProvider(params.provider);

  const payload: Record<string, unknown> = {
    model: provider.model,
    messages: params.messages.map(normalizeMessage),
    max_tokens: params.maxTokens || params.max_tokens || 4096,
  };

  if (params.tools && params.tools.length > 0) {
    payload.tools = params.tools;
  }

  const normalizedToolChoice = normalizeToolChoice(params.toolChoice || params.tool_choice, params.tools);
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
    throw new Error(`LLM invoke failed (${provider.model}): ${response.status} ${response.statusText} – ${errorText}`);
  }

  return (await response.json()) as InvokeResult;
}
