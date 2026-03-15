// src/providers/google-media.ts
import type { NoosphereProvider } from './base.js';
import type {
  Modality, ModelInfo, ImageOptions, NoosphereResult,
} from '../types.js';
import { getProviderLogo } from '../logos.js';

const GOOGLE_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const FETCH_TIMEOUT_MS = 8000;

function isImageModel(model: { name?: string; supportedGenerationMethods?: string[] }): boolean {
  const name = model.name ?? '';
  const methods: string[] = model.supportedGenerationMethods ?? [];
  return methods.includes('generateImages') || name.split('/').pop()?.startsWith('imagen') === true;
}

export class GoogleMediaProvider implements NoosphereProvider {
  readonly id = 'google-media';
  readonly name = 'Google (Image Generation)';
  readonly modalities: Modality[] = ['image'];
  readonly isLocal = false;

  private modelsCache: ModelInfo[] | null = null;

  constructor(private apiKey: string) {}

  async ping(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
      try {
        const res = await fetch(`${GOOGLE_API_BASE}/models?key=${this.apiKey}`, {
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
        const res = await fetch(`${GOOGLE_API_BASE}/models?key=${this.apiKey}`, {
          signal: controller.signal,
        });
        if (!res.ok) return [];
        data = await res.json();
      } finally {
        clearTimeout(timer);
      }

      const entries: Array<{
        name?: string;
        displayName?: string;
        description?: string;
        supportedGenerationMethods?: string[];
      }> = data?.models ?? [];

      const logo = getProviderLogo('google');
      const models: ModelInfo[] = [];

      for (const entry of entries) {
        if (!isImageModel(entry)) continue;

        // Google returns names like "models/imagen-3.0-generate-002"
        const fullName = entry.name ?? '';
        const modelId = fullName.startsWith('models/') ? fullName.slice('models/'.length) : fullName;

        const info: ModelInfo = {
          id: modelId,
          provider: 'google-media',
          name: entry.displayName ?? modelId,
          modality: 'image',
          local: false,
          cost: { price: 0, unit: 'per_image' },
          logo,
          description: entry.description,
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
    const model = options.model ?? 'imagen-3.0-generate-002';
    const start = Date.now();

    const body: Record<string, unknown> = {
      prompt: options.prompt,
      config: {
        numberOfImages: 1,
      },
    };

    const res = await fetch(
      `${GOOGLE_API_BASE}/models/${model}:generateImages?key=${this.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
    );

    if (!res.ok) {
      const errorBody = await res.text();
      throw new Error(`Google image generation failed (${res.status}): ${errorBody}`);
    }

    const data = await res.json() as any;
    const base64 = data?.generatedImages?.[0]?.image?.imageBytes;

    if (!base64) {
      throw new Error('Google image generation returned no image data');
    }

    const buffer = Buffer.from(base64, 'base64');

    return {
      buffer,
      provider: 'google-media',
      model,
      modality: 'image',
      latencyMs: Date.now() - start,
      usage: {
        cost: 0,
        unit: 'per_image',
      },
      media: {
        format: 'png',
      },
    };
  }
}
