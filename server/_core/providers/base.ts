/**
 * Base types and interface for all generation provider adapters.
 */

export interface GenerationRequest {
  prompt: string;
  negativePrompt?: string;
  width?: number;
  height?: number;
  steps?: number;
  model: string;
  quality?: "standard" | "hd";
  style?: "natural" | "vivid";
  options?: Record<string, unknown>;
}

export interface GenerationResult {
  id: string;
  url: string;
  model: string;
  provider: string;
  metadata: Record<string, unknown>;
}

export interface ProviderAdapter {
  readonly provider: string;
  /** Whether the provider has the required API key configured. */
  readonly isAvailable: boolean;
  generate(request: GenerationRequest): Promise<GenerationResult>;
}
