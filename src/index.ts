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
export {
  countTokens, countTokensOpenAI, countTokensGoogle, countTokensAnthropic,
  countTokensGroq, countTokensMistral, countTokensXai, countTokensCerebras,
  countTokensOpenRouter, countTokensOllama,
} from './token-counter.js';
export type { TokenCountResult, TokenCountOptions, TokenCountProvider } from './token-counter.js';

// --- Re-export pi-ai for direct access ---
// Agent loop with tool calling, preprocessor (compaction), and message queuing
export { agentLoop } from '@mariozechner/pi-ai';
// Cost calculation and model catalog
export { calculateCost, getModel as getPiModel, getModels as getPiModels, getProviders as getPiProviders } from '@mariozechner/pi-ai';
// Direct stream/complete APIs
export { stream as piStream, complete as piComplete, streamSimple as piStreamSimple, completeSimple as piCompleteSimple } from '@mariozechner/pi-ai';
// API key management
export { setApiKey, getApiKey } from '@mariozechner/pi-ai';
// Types
export type {
  // Agent types
  AgentContext, AgentLoopConfig, AgentTool, AgentEvent, QueuedMessage,
  // Message types
  Context as PiContext, Message as PiMessage, UserMessage as PiUserMessage,
  AssistantMessage as PiAssistantMessage, ToolResultMessage as PiToolResultMessage,
  // Content types
  TextContent, ThinkingContent, ImageContent as PiImageContent, ToolCall,
  // Model/API types
  Model as PiModel, Api as PiApi, KnownProvider, Provider as PiProvider,
  Usage as PiUsage, StopReason, ReasoningEffort,
  // Stream types
  StreamOptions as PiStreamOptions, SimpleStreamOptions, StreamFunction,
  AssistantMessageEvent, AssistantMessageEventStream,
  // Options types
  ApiOptionsMap, OptionsForApi,
} from '@mariozechner/pi-ai';
