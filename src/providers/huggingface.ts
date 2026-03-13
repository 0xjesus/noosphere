// src/providers/huggingface.ts
import { HfInference } from '@huggingface/inference';
import type { NoosphereProvider } from './base.js';
import type {
  Modality, ModelInfo, ChatOptions, ImageOptions, SpeakOptions, NoosphereResult,
} from '../types.js';

export class HuggingFaceProvider implements NoosphereProvider {
  readonly id = 'huggingface';
  readonly name = 'HuggingFace Inference';
  readonly modalities: Modality[] = ['image', 'tts', 'llm'];
  readonly isLocal = false;

  private client: HfInference;

  constructor(token: string) {
    this.client = new HfInference(token);
  }

  async ping(): Promise<boolean> {
    return true; // HF is always "available" if token exists
  }

  async listModels(modality?: Modality): Promise<ModelInfo[]> {
    // HuggingFace has thousands of models — return curated defaults
    const models: ModelInfo[] = [];

    if (!modality || modality === 'image') {
      models.push({
        id: 'stabilityai/stable-diffusion-xl-base-1.0',
        provider: 'huggingface', name: 'SDXL Base', modality: 'image',
        local: false, cost: { price: 0, unit: 'free' },
      });
    }
    if (!modality || modality === 'tts') {
      models.push({
        id: 'facebook/mms-tts-eng',
        provider: 'huggingface', name: 'MMS TTS English', modality: 'tts',
        local: false, cost: { price: 0, unit: 'free' },
      });
    }
    if (!modality || modality === 'llm') {
      models.push({
        id: 'meta-llama/Llama-3.1-8B-Instruct',
        provider: 'huggingface', name: 'Llama 3.1 8B', modality: 'llm',
        local: false, cost: { price: 0, unit: 'free' },
      });
    }

    return models;
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
