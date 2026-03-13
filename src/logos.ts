// src/logos.ts
// Provider logo URLs (SVG + PNG) for UI display

export interface ProviderLogo {
  svg?: string;
  png?: string;
}

/**
 * Known provider logos from official brand assets and CDNs.
 * Keys match provider IDs used throughout noosphere.
 */
export const PROVIDER_LOGOS: Record<string, ProviderLogo> = {
  // --- Cloud LLM Providers ---
  openai: {
    svg: 'https://cdn.simpleicons.org/openai',
    png: 'https://cdn.brandfetch.io/idR3duQxYl/w/512/h/512/theme/dark/icon.png',
  },
  anthropic: {
    svg: 'https://cdn.simpleicons.org/anthropic',
    png: 'https://cdn.brandfetch.io/id2S-kXbuM/w/512/h/512/theme/dark/icon.png',
  },
  google: {
    svg: 'https://cdn.simpleicons.org/google',
    png: 'https://cdn.brandfetch.io/id6O2oGzv-/w/512/h/512/theme/dark/icon.png',
  },
  groq: {
    svg: 'https://cdn.simpleicons.org/groq',
    png: 'https://cdn.brandfetch.io/idTEBPz5KO/w/512/h/512/theme/dark/icon.png',
  },
  mistral: {
    svg: 'https://cdn.simpleicons.org/mistral',
    png: 'https://cdn.brandfetch.io/idnBOFq5eF/w/512/h/512/theme/dark/icon.png',
  },
  xai: {
    svg: 'https://cdn.simpleicons.org/x',
    png: 'https://cdn.brandfetch.io/idS5WhqBbM/w/512/h/512/theme/dark/icon.png',
  },
  openrouter: {
    svg: 'https://openrouter.ai/favicon.svg',
    png: 'https://openrouter.ai/favicon.png',
  },
  cerebras: {
    svg: 'https://cdn.simpleicons.org/cerebras',
    png: 'https://cdn.brandfetch.io/idGa4PRFP0/w/512/h/512/theme/dark/icon.png',
  },

  // --- Media Providers ---
  fal: {
    svg: 'https://fal.ai/favicon.svg',
    png: 'https://fal.ai/favicon.png',
  },
  huggingface: {
    svg: 'https://cdn.simpleicons.org/huggingface',
    png: 'https://cdn.brandfetch.io/idnrPPHe87/w/512/h/512/theme/dark/icon.png',
  },

  // --- Local Providers ---
  comfyui: {
    svg: 'https://raw.githubusercontent.com/comfyanonymous/ComfyUI/master/web/assets/icon.svg',
    png: 'https://raw.githubusercontent.com/comfyanonymous/ComfyUI/master/web/assets/icon.png',
  },
  piper: {
    png: 'https://raw.githubusercontent.com/rhasspy/piper/master/logo.png',
  },
  kokoro: {
    png: 'https://raw.githubusercontent.com/hexgrad/kokoro/main/assets/icon.png',
  },
  ollama: {
    svg: 'https://cdn.simpleicons.org/ollama',
    png: 'https://cdn.brandfetch.io/idtesMoSFj/w/512/h/512/theme/dark/icon.png',
  },

  // --- Model Org Providers (from OpenRouter model prefixes) ---
  meta: {
    svg: 'https://cdn.simpleicons.org/meta',
    png: 'https://cdn.brandfetch.io/idmKk_rq7Y/w/512/h/512/theme/dark/icon.png',
  },
  deepseek: {
    png: 'https://cdn.brandfetch.io/id1BWKUVWI/w/512/h/512/theme/dark/icon.png',
  },
  microsoft: {
    svg: 'https://cdn.simpleicons.org/microsoft',
    png: 'https://cdn.brandfetch.io/idchmboHEZ/w/512/h/512/theme/dark/icon.png',
  },
  nvidia: {
    svg: 'https://cdn.simpleicons.org/nvidia',
    png: 'https://cdn.brandfetch.io/id1JcGHuZN/w/512/h/512/theme/dark/icon.png',
  },
  qwen: {
    png: 'https://img.alicdn.com/imgextra/i1/O1CN01BUp2gU1sRZigvazUo_!!6000000005764-2-tps-228-228.png',
  },
  cohere: {
    svg: 'https://cdn.simpleicons.org/cohere',
    png: 'https://cdn.brandfetch.io/idiDnz1fvB/w/512/h/512/theme/dark/icon.png',
  },
  perplexity: {
    svg: 'https://cdn.simpleicons.org/perplexity',
    png: 'https://cdn.brandfetch.io/idwWX3Neii/w/512/h/512/theme/dark/icon.png',
  },
  amazon: {
    svg: 'https://cdn.simpleicons.org/amazonaws',
    png: 'https://cdn.brandfetch.io/idawORoPJZ/w/512/h/512/theme/dark/icon.png',
  },

  // --- HuggingFace Inference Providers ---
  'hf-inference': {
    svg: 'https://cdn.simpleicons.org/huggingface',
    png: 'https://cdn.brandfetch.io/idnrPPHe87/w/512/h/512/theme/dark/icon.png',
  },
  'sambanova': {
    png: 'https://cdn.brandfetch.io/id__2e5yMY/w/512/h/512/theme/dark/icon.png',
  },
  'together': {
    svg: 'https://cdn.simpleicons.org/togetherai',
    png: 'https://cdn.brandfetch.io/idH5EoFVaH/w/512/h/512/theme/dark/icon.png',
  },
  'fireworks-ai': {
    png: 'https://cdn.brandfetch.io/idj1VQ2O4C/w/512/h/512/theme/dark/icon.png',
  },
  'replicate': {
    svg: 'https://cdn.simpleicons.org/replicate',
    png: 'https://cdn.brandfetch.io/idWKE4rRaH/w/512/h/512/theme/dark/icon.png',
  },
  'nebius': {
    png: 'https://cdn.brandfetch.io/idiUqSQ52b/w/512/h/512/theme/dark/icon.png',
  },
  'novita': {
    png: 'https://novita.ai/favicon.png',
  },
};

/**
 * Get logo for a provider by its ID.
 * Tries exact match first, then case-insensitive partial match.
 */
export function getProviderLogo(providerId: string | undefined | null): ProviderLogo | undefined {
  if (!providerId) return undefined;

  // Exact match
  if (PROVIDER_LOGOS[providerId]) return PROVIDER_LOGOS[providerId];

  // Normalize: lowercase, strip common suffixes
  const normalized = providerId.toLowerCase().replace(/[-_\s]/g, '');
  for (const [key, logo] of Object.entries(PROVIDER_LOGOS)) {
    if (key.replace(/[-_\s]/g, '') === normalized) return logo;
  }

  return undefined;
}
