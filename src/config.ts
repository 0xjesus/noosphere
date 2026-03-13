import type { NoosphereConfig, NoosphereErrorCode, LocalServiceConfig } from './types.js';

// Load .env / .env.vault (dotenvx supports both plain and encrypted)
// Falls back silently if dotenvx isn't installed — env vars from shell still work.
let _envLoaded = false;
function loadEnv(): void {
  if (_envLoaded) return;
  _envLoaded = true;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const dotenvx = require('@dotenvx/dotenvx');
    dotenvx.config({ quiet: true });
  } catch {
    // dotenvx not available — no-op
  }
}

const ENV_KEY_MAP: Record<string, string> = {
  openai: 'OPENAI_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
  google: 'GEMINI_API_KEY',
  fal: 'FAL_KEY',
  openrouter: 'OPENROUTER_API_KEY',
  huggingface: 'HUGGINGFACE_TOKEN',
  groq: 'GROQ_API_KEY',
  mistral: 'MISTRAL_API_KEY',
  xai: 'XAI_API_KEY',
};

const LOCAL_DEFAULTS: Record<string, { host: string; port: number; envHost: string; envPort: string }> = {
  ollama: { host: 'http://localhost', port: 11434, envHost: 'OLLAMA_HOST', envPort: 'OLLAMA_PORT' },
  comfyui: { host: 'http://localhost', port: 8188, envHost: 'COMFYUI_HOST', envPort: 'COMFYUI_PORT' },
  piper: { host: 'http://localhost', port: 5500, envHost: 'PIPER_HOST', envPort: 'PIPER_PORT' },
  kokoro: { host: 'http://localhost', port: 5501, envHost: 'KOKORO_HOST', envPort: 'KOKORO_PORT' },
};

const DEFAULT_RETRYABLE: NoosphereErrorCode[] = [
  'PROVIDER_UNAVAILABLE',
  'RATE_LIMITED',
  'TIMEOUT',
];

export interface ResolvedConfig {
  keys: Record<string, string | undefined>;
  local: Record<string, { enabled: boolean; host: string; port: number; type?: string }>;
  customLocal: LocalServiceConfig[];
  defaults: NonNullable<NoosphereConfig['defaults']>;
  autoDetectLocal: boolean;
  discoveryCacheTTL: number;
  retry: { maxRetries: number; backoffMs: number; retryableErrors: NoosphereErrorCode[]; failover: boolean };
  timeout: { llm: number; image: number; video: number; tts: number };
  onUsage?: NoosphereConfig['onUsage'];
}

export function resolveConfig(input: NoosphereConfig): ResolvedConfig {
  loadEnv();

  // Resolve API keys: config > env
  const keys: Record<string, string | undefined> = {};
  for (const [name, envVar] of Object.entries(ENV_KEY_MAP)) {
    keys[name] = input.keys?.[name as keyof NonNullable<NoosphereConfig['keys']>] ?? process.env[envVar];
  }

  // Resolve local services: config > env > defaults
  const local: Record<string, { enabled: boolean; host: string; port: number; type?: string }> = {};
  for (const [name, defaults] of Object.entries(LOCAL_DEFAULTS)) {
    const cfgLocal = input.local?.[name as keyof NonNullable<NoosphereConfig['local']>] as LocalServiceConfig | undefined;
    const envPort = process.env[defaults.envPort];
    const envHost = process.env[defaults.envHost];

    local[name] = {
      enabled: cfgLocal?.enabled ?? true,
      host: cfgLocal?.host ?? envHost ?? defaults.host,
      port: cfgLocal?.port ?? (envPort ? parseInt(envPort, 10) : defaults.port),
      type: cfgLocal?.type,
    };
  }

  const autoDetectEnv = process.env.NOOSPHERE_AUTO_DETECT_LOCAL;
  const cacheTTLEnv = process.env.NOOSPHERE_DISCOVERY_CACHE_TTL;

  return {
    keys,
    local,
    customLocal: input.local?.custom ?? [],
    defaults: input.defaults ?? {},
    autoDetectLocal: input.autoDetectLocal ?? (autoDetectEnv !== undefined ? autoDetectEnv !== 'false' : true),
    discoveryCacheTTL: input.discoveryCacheTTL ?? (cacheTTLEnv ? parseInt(cacheTTLEnv, 10) : 60),
    retry: {
      maxRetries: input.retry?.maxRetries ?? 2,
      backoffMs: input.retry?.backoffMs ?? 1000,
      retryableErrors: input.retry?.retryableErrors ?? DEFAULT_RETRYABLE,
      failover: input.retry?.failover ?? true,
    },
    timeout: {
      llm: input.timeout?.llm ?? 30000,
      image: input.timeout?.image ?? 120000,
      video: input.timeout?.video ?? 300000,
      tts: input.timeout?.tts ?? 60000,
    },
    onUsage: input.onUsage,
  };
}
