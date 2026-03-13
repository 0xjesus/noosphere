export type Modality = 'llm' | 'image' | 'video' | 'tts' | 'stt' | 'music' | 'embedding';

export type ModelStatus = 'installed' | 'available' | 'downloading' | 'running' | 'error';

export interface LocalModelInfo {
  sizeBytes: number;
  family?: string;
  parameterSize?: string;
  quantization?: string;
  format?: string;
  digest?: string;
  modifiedAt?: string;
  running?: boolean;
  vramRequired?: number;
  diskPath?: string;
  runtime: string;
}

export interface BaseOptions {
  provider?: string;
  model?: string;
  metadata?: Record<string, unknown>;
}

export interface ChatOptions extends BaseOptions {
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
}

export interface ImageOptions extends BaseOptions {
  prompt: string;
  negativePrompt?: string;
  width?: number;
  height?: number;
  seed?: number;
  steps?: number;
  guidanceScale?: number;
}

export interface VideoOptions extends BaseOptions {
  prompt: string;
  imageUrl?: string;
  duration?: number;
  fps?: number;
  width?: number;
  height?: number;
}

export interface SpeakOptions extends BaseOptions {
  text: string;
  voice?: string;
  language?: string;
  speed?: number;
  format?: 'mp3' | 'wav' | 'ogg';
}

export interface NoosphereResult {
  content?: string;
  thinking?: string;
  url?: string;
  buffer?: Buffer;
  provider: string;
  model: string;
  modality: Modality;
  latencyMs: number;
  usage: {
    cost: number;
    input?: number;
    output?: number;
    unit?: string;
  };
  media?: {
    width?: number;
    height?: number;
    duration?: number;
    format?: string;
    fps?: number;
  };
}

export interface StreamEvent {
  type: 'text_delta' | 'thinking_delta' | 'done' | 'error';
  delta?: string;
  error?: Error;
  result?: NoosphereResult;
}

export interface NoosphereStream extends AsyncIterable<StreamEvent> {
  result(): Promise<NoosphereResult>;
  abort(): void;
}

export interface ProviderLogo {
  svg?: string;
  png?: string;
}

export interface ModelInfo {
  id: string;
  provider: string;
  name: string;
  modality: Modality;
  local: boolean;
  cost: { price: number; unit: string };
  logo?: ProviderLogo;
  status?: ModelStatus;
  localInfo?: LocalModelInfo;
  capabilities?: {
    contextWindow?: number;
    maxTokens?: number;
    supportsVision?: boolean;
    supportsReasoning?: boolean;
    supportsFunctionCalling?: boolean;
    supportsStreaming?: boolean;
    maxWidth?: number;
    maxHeight?: number;
    supportsNegativePrompt?: boolean;
    maxDuration?: number;
    supportsImageToVideo?: boolean;
    voices?: string[];
    languages?: string[];
    supportsVoiceCloning?: boolean;
  };
}

export interface ProviderInfo {
  id: string;
  name: string;
  modalities: Modality[];
  local: boolean;
  status: 'online' | 'offline' | 'degraded';
  modelCount: number;
  logo?: ProviderLogo;
}

export interface UsageEvent {
  modality: Modality;
  provider: string;
  model: string;
  cost: number;
  latencyMs: number;
  input?: number;
  output?: number;
  unit?: string;
  timestamp: string;
  success: boolean;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface UsageQueryOptions {
  since?: string | Date;
  until?: string | Date;
  provider?: string;
  modality?: Modality;
}

export interface UsageSummary {
  totalCost: number;
  totalRequests: number;
  byProvider: Record<string, number>;
  byModality: Record<Modality, number>;
}

export interface SyncResult {
  synced: number;
  byProvider: Record<string, number>;
  errors: string[];
}

export type NoosphereErrorCode =
  | 'PROVIDER_UNAVAILABLE'
  | 'MODEL_NOT_FOUND'
  | 'AUTH_FAILED'
  | 'RATE_LIMITED'
  | 'TIMEOUT'
  | 'GENERATION_FAILED'
  | 'INVALID_INPUT'
  | 'NO_PROVIDER';

export interface LocalServiceConfig {
  enabled?: boolean;
  host?: string;
  port?: number;
  type?: string;
}

export interface NoosphereConfig {
  keys?: {
    openai?: string;
    anthropic?: string;
    google?: string;
    fal?: string;
    openrouter?: string;
    huggingface?: string;
    groq?: string;
    mistral?: string;
    xai?: string;
  };
  local?: {
    ollama?: LocalServiceConfig;
    comfyui?: LocalServiceConfig;
    piper?: LocalServiceConfig;
    kokoro?: LocalServiceConfig;
    custom?: LocalServiceConfig[];
  };
  defaults?: {
    llm?: { provider: string; model: string };
    image?: { provider: string; model: string };
    video?: { provider: string; model: string };
    tts?: { provider: string; model: string };
  };
  autoDetectLocal?: boolean;
  discoveryCacheTTL?: number;
  retry?: {
    maxRetries?: number;
    backoffMs?: number;
    retryableErrors?: NoosphereErrorCode[];
    failover?: boolean;
  };
  timeout?: {
    llm?: number;
    image?: number;
    video?: number;
    tts?: number;
  };
  onUsage?: (usage: UsageEvent) => void | Promise<void>;
}

export interface TranscriptionOptions extends BaseOptions {
  audio: string; // file path
  language?: string;
  task?: 'transcribe' | 'translate';
}

export interface TranscriptionResult {
  text: string;
  language: string;
  duration: number;
  segments?: Array<{ start: number; end: number; text: string }>;
}

export interface MusicOptions extends BaseOptions {
  prompt: string;
  duration?: number;
}
