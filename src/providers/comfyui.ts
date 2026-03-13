// src/providers/comfyui.ts
import type { NoosphereProvider } from './base.js';
import type { Modality, ModelInfo, ImageOptions, VideoOptions, NoosphereResult } from '../types.js';

interface ComfyUIConfig {
  host: string;
  port: number;
}

const DEFAULT_TXT2IMG_WORKFLOW = {
  '3': {
    class_type: 'KSampler',
    inputs: {
      seed: 0, steps: 20, cfg: 7, sampler_name: 'euler',
      scheduler: 'normal', denoise: 1,
      model: ['4', 0], positive: ['6', 0], negative: ['7', 0], latent_image: ['5', 0],
    },
  },
  '4': { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: 'sd_xl_base_1.0.safetensors' } },
  '5': { class_type: 'EmptyLatentImage', inputs: { width: 1024, height: 1024, batch_size: 1 } },
  '6': { class_type: 'CLIPTextEncode', inputs: { text: '', clip: ['4', 1] } },
  '7': { class_type: 'CLIPTextEncode', inputs: { text: '', clip: ['4', 1] } },
  '8': { class_type: 'VAEDecode', inputs: { samples: ['3', 0], vae: ['4', 2] } },
  '9': { class_type: 'SaveImage', inputs: { filename_prefix: 'noosphere', images: ['8', 0] } },
};

export class ComfyUIProvider implements NoosphereProvider {
  readonly id = 'comfyui';
  readonly name = 'ComfyUI';
  readonly modalities: Modality[] = ['image', 'video'];
  readonly isLocal = true;

  private baseUrl: string;

  constructor(config: ComfyUIConfig) {
    this.baseUrl = `${config.host}:${config.port}`;
  }

  async ping(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/system_stats`);
      return res.ok;
    } catch {
      return false;
    }
  }

  async listModels(modality?: Modality): Promise<ModelInfo[]> {
    try {
      const res = await fetch(`${this.baseUrl}/object_info`);
      if (!res.ok) return [];

      const models: ModelInfo[] = [];

      if (!modality || modality === 'image') {
        models.push({
          id: 'comfyui-txt2img', provider: 'comfyui', name: 'ComfyUI Text-to-Image',
          modality: 'image', local: true, cost: { price: 0, unit: 'free' },
          capabilities: { maxWidth: 2048, maxHeight: 2048, supportsNegativePrompt: true },
        });
      }
      if (!modality || modality === 'video') {
        models.push({
          id: 'comfyui-txt2vid', provider: 'comfyui', name: 'ComfyUI Text-to-Video',
          modality: 'video', local: true, cost: { price: 0, unit: 'free' },
          capabilities: { maxDuration: 10, supportsImageToVideo: true },
        });
      }

      return models;
    } catch {
      return [];
    }
  }

  async image(options: ImageOptions): Promise<NoosphereResult> {
    const start = Date.now();
    const workflow = structuredClone(DEFAULT_TXT2IMG_WORKFLOW);

    // Inject prompt
    (workflow['6'] as any).inputs.text = options.prompt;
    (workflow['7'] as any).inputs.text = options.negativePrompt ?? '';
    (workflow['5'] as any).inputs.width = options.width ?? 1024;
    (workflow['5'] as any).inputs.height = options.height ?? 1024;
    if (options.seed !== undefined) (workflow['3'] as any).inputs.seed = options.seed;
    if (options.steps !== undefined) (workflow['3'] as any).inputs.steps = options.steps;
    if (options.guidanceScale !== undefined) (workflow['3'] as any).inputs.cfg = options.guidanceScale;

    // Queue prompt
    const queueRes = await fetch(`${this.baseUrl}/prompt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: workflow }),
    });
    if (!queueRes.ok) throw new Error(`ComfyUI queue failed: ${queueRes.status}`);
    const { prompt_id } = await queueRes.json() as { prompt_id: string };

    // Poll for completion
    const imageData = await this.pollForResult(prompt_id);

    return {
      buffer: Buffer.from(imageData),
      provider: 'comfyui',
      model: options.model ?? 'comfyui-txt2img',
      modality: 'image',
      latencyMs: Date.now() - start,
      usage: { cost: 0, unit: 'free' },
      media: {
        width: options.width ?? 1024,
        height: options.height ?? 1024,
        format: 'png',
      },
    };
  }

  async video(_options: VideoOptions): Promise<NoosphereResult> {
    // TODO: Video workflow templates will be added when ComfyUI video nodes are configured
    throw new Error('ComfyUI video generation requires a configured AnimateDiff workflow');
  }

  private async pollForResult(promptId: string, maxWaitMs = 300000): Promise<ArrayBuffer> {
    const deadline = Date.now() + maxWaitMs;

    while (Date.now() < deadline) {
      const res = await fetch(`${this.baseUrl}/history/${promptId}`);
      if (!res.ok) {
        await new Promise((r) => setTimeout(r, 1000));
        continue;
      }

      const history = await res.json() as Record<string, any>;
      const entry = history[promptId];
      if (!entry?.outputs) {
        await new Promise((r) => setTimeout(r, 1000));
        continue;
      }

      // Find the SaveImage output node
      for (const nodeOutput of Object.values(entry.outputs) as any[]) {
        if (nodeOutput.images?.length > 0) {
          const img = nodeOutput.images[0];
          const imgRes = await fetch(
            `${this.baseUrl}/view?filename=${img.filename}&subfolder=${img.subfolder}&type=${img.type}`,
          );
          return imgRes.arrayBuffer();
        }
      }

      await new Promise((r) => setTimeout(r, 1000));
    }

    throw new Error(`ComfyUI generation timed out after ${maxWaitMs}ms`);
  }
}
