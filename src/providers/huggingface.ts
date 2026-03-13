// src/providers/huggingface.ts
import { HfInference } from '@huggingface/inference';
import type { NoosphereProvider } from './base.js';
import type {
  Modality, ModelInfo, ChatOptions, ImageOptions, SpeakOptions, NoosphereResult, ProviderLogo,
} from '../types.js';
import { getProviderLogo } from '../logos.js';

const HF_HUB_API = 'https://huggingface.co/api/models';
const FETCH_TIMEOUT_MS = 10000;

// Pipeline tag → Noosphere modality mapping
const PIPELINE_TAG_MAP: Record<string, { modality: Modality; limit: number }> = {
  'text-generation': { modality: 'llm', limit: 50 },
  'text-to-image': { modality: 'image', limit: 50 },
  'text-to-speech': { modality: 'tts', limit: 30 },
};


export class HuggingFaceProvider implements NoosphereProvider {
  readonly id = 'huggingface';
  readonly name = 'HuggingFace Inference';
  readonly modalities: Modality[] = ['image', 'tts', 'llm'];
  readonly isLocal = false;

  private client: HfInference;
  private token: string;
  private dynamicModels: ModelInfo[] | null = null;

  constructor(token: string) {
    this.token = token;
    this.client = new HfInference(token);
  }

  async ping(): Promise<boolean> {
    return true;
  }

  async listModels(modality?: Modality): Promise<ModelInfo[]> {
    // 100% dynamic — fetch from Hub API (once, cached after)
    if (!this.dynamicModels) {
      await this.fetchHubModels();
    }

    const all = this.dynamicModels ?? [];
    if (modality) return all.filter((m) => m.modality === modality);
    return all;
  }

  private async fetchHubModels(): Promise<void> {
    const seenIds = new Set<string>();
    const models: ModelInfo[] = [];

    // 100% dynamic — fetch trending models per pipeline_tag in parallel
    const fetches = Object.entries(PIPELINE_TAG_MAP).map(
      ([tag, { modality, limit }]) => this.fetchByPipelineTag(tag, modality, limit),
    );

    const results = await Promise.allSettled(fetches);

    for (const result of results) {
      if (result.status !== 'fulfilled') continue;
      for (const model of result.value) {
        if (seenIds.has(model.id)) continue;
        seenIds.add(model.id);
        models.push(model);
      }
    }

    this.dynamicModels = models;
  }

  private async fetchByPipelineTag(
    pipelineTag: string,
    modality: Modality,
    limit: number,
  ): Promise<ModelInfo[]> {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

      try {
        const params = new URLSearchParams({
          pipeline_tag: pipelineTag,
          inference_provider: 'all',
          sort: 'trendingScore',
          limit: String(limit),
          'expand[]': 'inferenceProviderMapping',
        });

        const res = await fetch(`${HF_HUB_API}?${params}`, {
          headers: this.token ? { Authorization: `Bearer ${this.token}` } : {},
          signal: controller.signal,
        });
        if (!res.ok) return [];

        const data = await res.json() as Array<{
          id?: string;
          modelId?: string;
          pipeline_tag?: string;
          likes?: number;
          downloads?: number;
          inferenceProviderMapping?: Array<{
            provider: string;
            providerId: string;
            status: string;
            providerDetails?: { context_length?: number; pricing?: { input?: number; output?: number } };
          }>;
        }>;

        return data
          .filter((entry) => entry.id || entry.modelId)
          .map((entry) => {
            const id = entry.id ?? entry.modelId!;
            const liveProviders = (entry.inferenceProviderMapping ?? [])
              .filter((p) => p.status === 'live');
            const providers = liveProviders.map((p) => p.provider);

            // Build per-inference-provider logos
            const inferenceProviderLogos: Record<string, ProviderLogo> = {};
            for (const p of liveProviders) {
              const pLogo = getProviderLogo(p.provider);
              if (pLogo) inferenceProviderLogos[p.provider] = pLogo;
            }

            // Try to extract pricing from first provider with pricing data
            const pricingProvider = (entry.inferenceProviderMapping ?? [])
              .find((p) => p.providerDetails?.pricing);
            const pricing = pricingProvider?.providerDetails?.pricing;
            const contextLength = (entry.inferenceProviderMapping ?? [])
              .find((p) => p.providerDetails?.context_length)?.providerDetails?.context_length;

            return {
              id,
              provider: 'huggingface',
              name: id.split('/').pop() ?? id,
              modality,
              local: false,
              cost: {
                price: pricing?.input ?? 0,
                unit: pricing ? 'per_1m_tokens' : 'free',
              },
              logo: getProviderLogo('huggingface'),
              capabilities: {
                ...(modality === 'llm' ? {
                  contextWindow: contextLength,
                  supportsStreaming: true,
                } : {}),
                ...(providers.length > 0 ? { inferenceProviders: providers } : {}),
                ...(Object.keys(inferenceProviderLogos).length > 0 ? { inferenceProviderLogos } : {}),
              },
            } as ModelInfo;
          });
      } finally {
        clearTimeout(timer);
      }
    } catch {
      return [];
    }
  }

  async chat(options: ChatOptions): Promise<NoosphereResult> {
    const start = Date.now();
    const model = options.model ?? 'meta-llama/Llama-3.1-8B-Instruct';

    const response = await this.client.chatCompletion({
      model,
      messages: options.messages,
      temperature: options.temperature,
      max_tokens: options.maxTokens,
    });

    const choice = response.choices?.[0];
    const usage = response.usage;

    return {
      content: choice?.message?.content ?? '',
      provider: 'huggingface',
      model,
      modality: 'llm',
      latencyMs: Date.now() - start,
      usage: {
        cost: 0,
        input: usage?.prompt_tokens,
        output: usage?.completion_tokens,
        unit: 'tokens',
      },
    };
  }

  async image(options: ImageOptions): Promise<NoosphereResult> {
    const start = Date.now();
    const model = options.model ?? 'stabilityai/stable-diffusion-xl-base-1.0';

    const blob = await this.client.textToImage({
      model,
      inputs: options.prompt,
      parameters: {
        negative_prompt: options.negativePrompt,
        width: options.width,
        height: options.height,
        guidance_scale: options.guidanceScale,
        num_inference_steps: options.steps,
      },
    }, { outputType: 'blob' });

    const buffer = Buffer.from(await blob.arrayBuffer());

    return {
      buffer,
      provider: 'huggingface',
      model,
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

  async speak(options: SpeakOptions): Promise<NoosphereResult> {
    const start = Date.now();
    const model = options.model ?? 'facebook/mms-tts-eng';

    const blob = await this.client.textToSpeech({
      model,
      inputs: options.text,
    });

    const buffer = Buffer.from(await blob.arrayBuffer());

    return {
      buffer,
      provider: 'huggingface',
      model,
      modality: 'tts',
      latencyMs: Date.now() - start,
      usage: {
        cost: 0,
        input: options.text.length,
        unit: 'characters',
      },
      media: { format: 'wav' },
    };
  }
}
