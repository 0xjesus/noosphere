// src/providers/fal.ts
import { fal } from '@fal-ai/client';
import type { NoosphereProvider } from './base.js';
import type {
  Modality, ModelInfo, ImageOptions, VideoOptions, SpeakOptions, NoosphereResult,
} from '../types.js';

const FAL_PRICING_URL = 'https://api.fal.ai/v1/models/pricing';

export class FalProvider implements NoosphereProvider {
  readonly id = 'fal';
  readonly name = 'fal.ai';
  readonly modalities: Modality[] = ['image', 'video', 'tts'];
  readonly isLocal = false;

  private apiKey: string;
  private pricingCache: Map<string, { price: number; unit: string }> = new Map();

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    fal.config({ credentials: apiKey });
  }

  async ping(): Promise<boolean> {
    return !!this.apiKey;
  }

  async listModels(modality?: Modality): Promise<ModelInfo[]> {
    try {
      const res = await fetch(FAL_PRICING_URL, {
        headers: { Authorization: `Key ${this.apiKey}` },
      });
      if (!res.ok) return [];

      const data = await res.json() as Array<{ modelId: string; price: number; unit: string }>;
      this.pricingCache.clear();

      const models: ModelInfo[] = [];
      for (const entry of data) {
        const inferredModality = this.inferModality(entry.modelId, entry.unit);
        if (modality && inferredModality !== modality) continue;

        this.pricingCache.set(entry.modelId, { price: entry.price, unit: entry.unit });
        models.push({
          id: entry.modelId,
          provider: 'fal',
          name: entry.modelId.replace('fal-ai/', ''),
          modality: inferredModality,
          local: false,
          cost: { price: entry.price, unit: entry.unit },
        });
      }
      return models;
    } catch {
      return [];
    }
  }

  async image(options: ImageOptions): Promise<NoosphereResult> {
    const model = options.model ?? 'fal-ai/flux/schnell';
    const start = Date.now();

    const response = await fal.subscribe(model, {
      input: {
        prompt: options.prompt,
        negative_prompt: options.negativePrompt,
        image_size: options.width && options.height
          ? { width: options.width, height: options.height }
          : undefined,
        seed: options.seed,
        num_inference_steps: options.steps,
        guidance_scale: options.guidanceScale,
      },
    });

    const image = (response.data as any)?.images?.[0];
    const pricing = this.pricingCache.get(model);

    return {
      url: image?.url,
      provider: 'fal',
      model,
      modality: 'image',
      latencyMs: Date.now() - start,
      usage: {
        cost: pricing?.price ?? 0,
        unit: pricing?.unit ?? 'per_image',
      },
      media: {
        width: image?.width,
        height: image?.height,
        format: 'png',
      },
    };
  }

  async video(options: VideoOptions): Promise<NoosphereResult> {
    const model = options.model ?? 'fal-ai/kling-video/v2/master/text-to-video';
    const start = Date.now();

    const response = await fal.subscribe(model, {
      input: {
        prompt: options.prompt,
        image_url: options.imageUrl,
        duration: options.duration,
        fps: options.fps,
      },
    });

    const video = (response.data as any)?.video;
    const pricing = this.pricingCache.get(model);

    return {
      url: video?.url ?? (response.data as any)?.video_url,
      provider: 'fal',
      model,
      modality: 'video',
      latencyMs: Date.now() - start,
      usage: {
        cost: pricing?.price ?? 0,
        unit: pricing?.unit ?? 'per_second',
      },
      media: {
        width: options.width,
        height: options.height,
        duration: options.duration,
        format: 'mp4',
        fps: options.fps,
      },
    };
  }

  async speak(options: SpeakOptions): Promise<NoosphereResult> {
    const model = options.model ?? 'fal-ai/kokoro/american-english';
    const start = Date.now();

    const response = await fal.run(model, {
      input: {
        text: options.text,
        voice: options.voice,
        speed: options.speed,
      },
    });

    const audioUrl = (response.data as any)?.audio_url ?? (response.data as any)?.audio?.url;
    const pricing = this.pricingCache.get(model);

    return {
      url: audioUrl,
      provider: 'fal',
      model,
      modality: 'tts',
      latencyMs: Date.now() - start,
      usage: {
        cost: pricing?.price ?? 0,
        input: options.text.length,
        unit: pricing?.unit ?? 'per_1k_chars',
      },
      media: {
        format: options.format ?? 'mp3',
      },
    };
  }

  private inferModality(modelId: string, unit: string): Modality {
    if (unit.includes('char') || modelId.includes('tts') || modelId.includes('kokoro') || modelId.includes('elevenlabs')) return 'tts';
    if (unit.includes('second') || modelId.includes('video') || modelId.includes('kling') || modelId.includes('sora') || modelId.includes('veo')) return 'video';
    return 'image';
  }
}
