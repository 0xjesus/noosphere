// src/providers/openai-media.ts
import type { NoosphereProvider } from './base.js';
import type {
  Modality, ModelInfo, ImageOptions, SpeakOptions, NoosphereResult,
} from '../types.js';
import { getProviderLogo } from '../logos.js';

const OPENAI_API_BASE = 'https://api.openai.com/v1';
const FETCH_TIMEOUT_MS = 8000;

/** Prefix-to-modality mapping for non-LLM OpenAI models. */
const MODEL_PREFIX_MAP: Array<{ prefix: string; modality: Modality }> = [
  { prefix: 'dall-e-', modality: 'image' },
  { prefix: 'gpt-image-', modality: 'image' },
  { prefix: 'tts-', modality: 'tts' },
  { prefix: 'whisper-', modality: 'stt' },
];

function classifyModel(id: string): Modality | null {
  for (const { prefix, modality } of MODEL_PREFIX_MAP) {
    if (id.startsWith(prefix)) return modality;
  }
  return null;
}

export class OpenAIMediaProvider implements NoosphereProvider {
  readonly id = 'openai-media';
  readonly name = 'OpenAI (Image, TTS, STT)';
  readonly modalities: Modality[] = ['image', 'tts', 'stt'];
  readonly isLocal = false;

  private modelsCache: ModelInfo[] | null = null;

  constructor(private apiKey: string) {}

  async ping(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
      try {
        const res = await fetch(`${OPENAI_API_BASE}/models`, {
          headers: { Authorization: `Bearer ${this.apiKey}` },
          signal: controller.signal,
        });
        return res.ok;
      } finally {
        clearTimeout(timer);
      }
    } catch {
      return false;
    }
  }

  async listModels(modality?: Modality): Promise<ModelInfo[]> {
    if (this.modelsCache) {
      return modality
        ? this.modelsCache.filter((m) => m.modality === modality)
        : this.modelsCache;
    }

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
      let data: any;
      try {
        const res = await fetch(`${OPENAI_API_BASE}/models`, {
          headers: { Authorization: `Bearer ${this.apiKey}` },
          signal: controller.signal,
        });
        if (!res.ok) return [];
        data = await res.json();
      } finally {
        clearTimeout(timer);
      }

      const entries: Array<{ id: string; description?: string }> = data?.data ?? [];
      const logo = getProviderLogo('openai');

      const models: ModelInfo[] = [];
      for (const entry of entries) {
        const mod = classifyModel(entry.id);
        if (!mod) continue;

        const info: ModelInfo = {
          id: entry.id,
          provider: 'openai-media',
          name: entry.id,
          modality: mod,
          local: false,
          cost: { price: 0, unit: 'per_request' },
          logo,
          description: entry.description,
          capabilities: this.getCapabilities(entry.id, mod),
        };
        models.push(info);
      }

      this.modelsCache = models;

      return modality
        ? models.filter((m) => m.modality === modality)
        : models;
    } catch {
      return [];
    }
  }

  async image(options: ImageOptions): Promise<NoosphereResult> {
    const model = options.model ?? 'dall-e-3';
    const width = options.width ?? 1024;
    const height = options.height ?? 1024;
    const start = Date.now();

    const body: Record<string, unknown> = {
      model,
      prompt: options.prompt,
      n: 1,
      size: `${width}x${height}`,
      response_format: 'url',
    };

    const res = await fetch(`${OPENAI_API_BASE}/images/generations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errorBody = await res.text();
      throw new Error(`OpenAI image generation failed (${res.status}): ${errorBody}`);
    }

    const data = await res.json() as any;
    const imageUrl = data?.data?.[0]?.url;

    return {
      url: imageUrl,
      provider: 'openai-media',
      model,
      modality: 'image',
      latencyMs: Date.now() - start,
      usage: {
        cost: 0,
        unit: 'per_image',
      },
      media: {
        width,
        height,
        format: 'png',
      },
    };
  }

  async speak(options: SpeakOptions): Promise<NoosphereResult> {
    const model = options.model ?? 'tts-1';
    const voice = options.voice ?? 'alloy';
    const format = options.format ?? 'mp3';
    const speed = options.speed ?? 1.0;
    const start = Date.now();

    const body = {
      model,
      input: options.text,
      voice,
      response_format: format,
      speed,
    };

    const res = await fetch(`${OPENAI_API_BASE}/audio/speech`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errorBody = await res.text();
      throw new Error(`OpenAI TTS failed (${res.status}): ${errorBody}`);
    }

    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    return {
      buffer,
      provider: 'openai-media',
      model,
      modality: 'tts',
      latencyMs: Date.now() - start,
      usage: {
        cost: 0,
        input: options.text.length,
        unit: 'per_1k_chars',
      },
      media: {
        format,
      },
    };
  }

  private getCapabilities(id: string, modality: Modality): ModelInfo['capabilities'] {
    if (modality === 'image') {
      return {
        maxWidth: id.startsWith('dall-e-3') ? 1792 : 1024,
        maxHeight: id.startsWith('dall-e-3') ? 1792 : 1024,
      };
    }
    if (modality === 'tts') {
      return {
        voices: ['alloy', 'ash', 'coral', 'echo', 'fable', 'onyx', 'nova', 'sage', 'shimmer'],
      };
    }
    if (modality === 'stt') {
      return {
        languages: ['en', 'zh', 'de', 'es', 'ru', 'ko', 'fr', 'ja', 'pt', 'tr', 'pl', 'ca', 'nl', 'ar', 'sv', 'it', 'id', 'hi', 'fi', 'vi', 'he', 'uk', 'el', 'ms', 'cs', 'ro', 'da', 'hu', 'ta', 'no', 'th', 'ur', 'hr', 'bg', 'lt', 'la', 'mi', 'ml', 'cy', 'sk', 'te', 'fa', 'lv', 'bn', 'sr', 'az', 'sl', 'kn', 'et', 'mk', 'br', 'eu', 'is', 'hy', 'ne', 'mn', 'bs', 'kk', 'sq', 'sw', 'gl', 'mr', 'pa', 'si', 'km', 'sn', 'yo', 'so', 'af', 'oc', 'ka', 'be', 'tg', 'sd', 'gu', 'am', 'yi', 'lo', 'uz', 'fo', 'ht', 'ps', 'tk', 'nn', 'mt', 'sa', 'lb', 'my', 'bo', 'tl', 'mg', 'as', 'tt', 'haw', 'ln', 'ha', 'ba', 'jw', 'su'],
      };
    }
    return undefined;
  }
}
