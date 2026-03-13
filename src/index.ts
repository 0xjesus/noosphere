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
} from './types.js';
export type { NoosphereProvider } from './providers/base.js';
export { PROVIDER_LOGOS, getProviderLogo, getAllProviderLogos, PROVIDER_IDS } from './logos.js';
