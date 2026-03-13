// src/logos.ts
// Provider logos bundled as local assets (assets/logos/)
// SVG + PNG (512x512) for each provider — official logos from brand pages.

import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import { existsSync } from 'fs';

export interface ProviderLogo {
  svg?: string;
  png?: string;
}

// Resolve assets dir relative to this file (works in both ESM and CJS)
let _assetsDir: string | null = null;
function assetsDir(): string {
  if (_assetsDir) return _assetsDir;
  try {
    // ESM
    const __filename = fileURLToPath(import.meta.url);
    _assetsDir = resolve(dirname(__filename), '..', 'assets', 'logos');
  } catch {
    // CJS fallback
    _assetsDir = resolve(__dirname, '..', 'assets', 'logos');
  }
  return _assetsDir;
}

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

// Cache resolved paths
const _cache = new Map<string, ProviderLogo>();

/**
 * Get local file paths to a provider's logo assets.
 * Returns absolute paths to SVG and/or PNG files in assets/logos/.
 */
export function getProviderLogo(providerId: string | undefined | null): ProviderLogo | undefined {
  if (!providerId) return undefined;

  // Check cache
  const cached = _cache.get(providerId);
  if (cached) return cached;

  // Normalize
  const normalized = providerId.toLowerCase().replace(/[-_\s]/g, '');

  // Try exact match first, then fuzzy
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

  const dir = assetsDir();
  const svgPath = join(dir, 'svg', `${matchedId}.svg`);
  const pngPath = join(dir, 'png', `${matchedId}.png`);

  const logo: ProviderLogo = {};
  if (existsSync(svgPath)) logo.svg = svgPath;
  if (existsSync(pngPath)) logo.png = pngPath;

  if (!logo.svg && !logo.png) return undefined;

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

// For backwards compat — re-export as PROVIDER_LOGOS (lazy-loaded)
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
