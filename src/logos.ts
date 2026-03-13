// src/logos.ts
// Provider logos served from DigitalOcean Spaces CDN.
// SVG + PNG (512×512) for each provider.

export interface ProviderLogo {
  svg?: string;
  png?: string;
}

const CDN_BASE = 'https://blockchainstarter.nyc3.digitaloceanspaces.com/noosphere/logos';

/**
 * All known provider IDs with logo assets.
 */
export const PROVIDER_IDS = [
  // Cloud LLM
  'openai', 'anthropic', 'google', 'groq', 'mistral', 'xai',
  'openrouter', 'cerebras', 'pi-ai',
  // Media
  'fal', 'huggingface',
  // Local
  'comfyui', 'piper', 'kokoro', 'ollama',
  // Model orgs (from OpenRouter prefixes)
  'meta', 'deepseek', 'microsoft', 'nvidia', 'qwen',
  'cohere', 'perplexity', 'amazon',
  // Additional model orgs
  'zai', 'minimax', 'baidu', 'bytedance', 'tencent',
  'xiaomi', 'ibm', 'ai21', 'inflection', 'upstage',
  // HuggingFace inference providers
  'sambanova', 'together', 'fireworks-ai', 'replicate', 'nebius', 'novita',
] as const;

export type ProviderId = (typeof PROVIDER_IDS)[number];

// Providers that have SVGs available
const HAS_SVG = new Set<string>([
  'openai', 'anthropic', 'google', 'groq', 'mistral', 'xai',
  'openrouter', 'cerebras', 'huggingface', 'ollama',
  'meta', 'deepseek', 'microsoft', 'nvidia', 'qwen',
  'cohere', 'perplexity', 'amazon', 'baidu',
  'together', 'fireworks-ai', 'replicate', 'nebius', 'novita',
  'comfyui', 'fal', 'kokoro', 'piper', 'sambanova', 'pi-ai', 'zai',
  // NO SVG: bytedance, tencent, xiaomi, ibm, ai21, inflection, upstage, minimax
]);

// Cache
const _cache = new Map<string, ProviderLogo>();

/**
 * Get CDN URLs for a provider's logo.
 */
export function getProviderLogo(providerId: string | undefined | null): ProviderLogo | undefined {
  if (!providerId) return undefined;

  const cached = _cache.get(providerId);
  if (cached) return cached;

  const normalized = providerId.toLowerCase().replace(/[-_\s]/g, '');

  let matchedId: string | null = null;
  for (const id of PROVIDER_IDS) {
    if (id === providerId) { matchedId = id; break; }
  }
  if (!matchedId) {
    for (const id of PROVIDER_IDS) {
      if (id.replace(/[-_\s]/g, '') === normalized) { matchedId = id; break; }
    }
  }

  if (!matchedId) return undefined;

  const logo: ProviderLogo = {
    png: `${CDN_BASE}/png/${matchedId}.png`,
  };
  if (HAS_SVG.has(matchedId)) {
    logo.svg = `${CDN_BASE}/svg/${matchedId}.svg`;
  }

  _cache.set(providerId, logo);
  return logo;
}

/**
 * Get all provider logos as a map.
 */
export function getAllProviderLogos(): Record<string, ProviderLogo> {
  const result: Record<string, ProviderLogo> = {};
  for (const id of PROVIDER_IDS) {
    const logo = getProviderLogo(id);
    if (logo) result[id] = logo;
  }
  return result;
}

// Backwards-compat lazy proxy
let _allLogos: Record<string, ProviderLogo> | null = null;
export const PROVIDER_LOGOS: Record<string, ProviderLogo> = new Proxy({} as Record<string, ProviderLogo>, {
  get(_, prop: string) {
    if (!_allLogos) _allLogos = getAllProviderLogos();
    return _allLogos[prop];
  },
  ownKeys() {
    if (!_allLogos) _allLogos = getAllProviderLogos();
    return Object.keys(_allLogos);
  },
  getOwnPropertyDescriptor(_, prop: string) {
    if (!_allLogos) _allLogos = getAllProviderLogos();
    if (prop in _allLogos) {
      return { configurable: true, enumerable: true, value: _allLogos[prop] };
    }
    return undefined;
  },
  has(_, prop: string) {
    if (!_allLogos) _allLogos = getAllProviderLogos();
    return prop in _allLogos;
  },
});
