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
  generate(request: GenerationRequest): Promise<GenerationResult>;
}
