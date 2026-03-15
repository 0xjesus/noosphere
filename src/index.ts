// src/index.ts
export { Noosphere } from './noosphere.js';
export { NoosphereError } from './errors.js';
export type {
  NoosphereConfig,
  NoosphereResult,
  NoosphereStream,
  StreamEvent,
  Modality,
  ModelInfo,
  ProviderInfo,
  ChatOptions,
  ImageOptions,
  VideoOptions,
  SpeakOptions,
  BaseOptions,
  UsageEvent,
  UsageQueryOptions,
  UsageSummary,
  SyncResult,
  NoosphereErrorCode,
  LocalServiceConfig,
  ProviderLogo,
  ModelStatus,
  LocalModelInfo,
  TranscriptionOptions,
  TranscriptionResult,
  MusicOptions,
} from './types.js';
export type { NoosphereProvider } from './providers/base.js';
export { OllamaProvider } from './providers/ollama.js';
export type { OllamaPullProgress, OllamaModelDetail, OllamaRunningModel } from './providers/ollama.js';
export { HfLocalProvider } from './providers/hf-local.js';
export { WhisperLocalProvider } from './providers/whisper-local.js';
export { AudioCraftProvider } from './providers/audiocraft.js';
export { OpenAICompatProvider, detectOpenAICompatServers } from './providers/openai-compat.js';
export { OpenAIMediaProvider } from './providers/openai-media.js';
export { GoogleMediaProvider } from './providers/google-media.js';
export type { OpenAICompatConfig } from './providers/openai-compat.js';
export { PROVIDER_LOGOS, getProviderLogo, getAllProviderLogos, PROVIDER_IDS } from './logos.js';
