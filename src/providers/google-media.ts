// src/providers/google-media.ts
import type { NoosphereProvider } from './base.js';
import type {
  Modality, ModelInfo, ImageOptions, VideoOptions, SpeakOptions, NoosphereResult,
} from '../types.js';
import { getProviderLogo } from '../logos.js';

const GOOGLE_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const FETCH_TIMEOUT_MS = 8000;

/** Auto-fetch available TTS voices by sending an invalid voice and parsing the error. */
async function fetchGoogleVoices(apiKey: string): Promise<string[]> {
  try {
    const res = await fetch(
      `${GOOGLE_API_BASE}/models/gemini-2.5-flash-preview-tts:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: '.' }] }],
          generationConfig: {
            response_modalities: ['AUDIO'],
            speech_config: { voiceConfig: { prebuiltVoiceConfig: { voiceName: '__discover_voices__' } } },
          },
        }),
      },
    );
    if (!res.ok) {
      const data = await res.json() as any;
      const msg: string = data?.error?.message ?? '';
      // Parse: "Allowed voice names are: achernar, achird, algenib, ..."
      const match = msg.match(/Allowed voice names are:\s*(.+)/i);
      if (match) {
        return match[1].split(',').map((v) => v.trim()).filter(Boolean);
      }
    }
  } catch { /* fallback */ }
  return [];
}

function classifyGoogleModel(model: { name?: string; supportedGenerationMethods?: string[] }): Modality | null {
  const name = (model.name ?? '').replace('models/', '');
  const methods: string[] = model.supportedGenerationMethods ?? [];
  if (name.startsWith('imagen') && methods.includes('predict')) return 'image';
  if (name.startsWith('veo') && methods.includes('predictLongRunning')) return 'video';
  if (name.includes('-tts') && methods.includes('generateContent')) return 'tts';
  return null;
}

export class GoogleMediaProvider implements NoosphereProvider {
  readonly id = 'google-media';
  readonly name = 'Google (Image, Video, TTS)';
  readonly modalities: Modality[] = ['image', 'video', 'tts'];
  readonly isLocal = false;

  private modelsCache: ModelInfo[] | null = null;
  private voicesCache: string[] | null = null;

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

      // Auto-fetch voices in parallel
      if (!this.voicesCache) {
        this.voicesCache = await fetchGoogleVoices(this.apiKey);
      }

      const logo = getProviderLogo('google');
      const models: ModelInfo[] = [];

      for (const entry of entries) {
        const modality = classifyGoogleModel(entry);
        if (!modality) continue;

        const fullName = entry.name ?? '';
        const modelId = fullName.startsWith('models/') ? fullName.slice('models/'.length) : fullName;

        const info: ModelInfo = {
          id: modelId,
          provider: 'google-media',
          name: entry.displayName ?? modelId,
          modality,
          local: false,
          cost: { price: 0, unit: modality === 'video' ? 'per_video' : 'per_image' },
          logo,
          description: entry.description,
          capabilities: modality === 'video'
            ? { maxDuration: 8, supportsStreaming: false }
            : modality === 'tts'
              ? { voices: this.voicesCache && this.voicesCache.length > 0 ? this.voicesCache : undefined }
              : undefined,
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
    const model = options.model ?? 'imagen-4.0-generate-001';
    const start = Date.now();

    const body: Record<string, unknown> = {
      instances: [{ prompt: options.prompt }],
      parameters: {
        sampleCount: 1,
      },
    };

    const res = await fetch(
      `${GOOGLE_API_BASE}/models/${model}:predict?key=${this.apiKey}`,
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
    // predict endpoint returns { predictions: [{ bytesBase64Encoded: "..." }] }
    // or { generatedImages: [{ image: { imageBytes: "..." } }] }
    const base64 = data?.predictions?.[0]?.bytesBase64Encoded
      ?? data?.generatedImages?.[0]?.image?.imageBytes;

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

  async speak(options: SpeakOptions): Promise<NoosphereResult> {
    const model = options.model ?? 'gemini-2.5-flash-preview-tts';
    const voice = options.voice ?? 'Kore';
    const start = Date.now();

    const body = {
      contents: [{ parts: [{ text: options.text }] }],
      generationConfig: {
        response_modalities: ['AUDIO'],
        speech_config: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voice },
          },
        },
      },
    };

    const res = await fetch(
      `${GOOGLE_API_BASE}/models/${model}:generateContent?key=${this.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
    );

    if (!res.ok) {
      const errorBody = await res.text();
      throw new Error(`Google TTS failed (${res.status}): ${errorBody}`);
    }

    const data = await res.json() as any;
    const inlineData = data?.candidates?.[0]?.content?.parts?.[0]?.inlineData;

    if (!inlineData?.data) {
      throw new Error('Google TTS returned no audio data');
    }

    const buffer = Buffer.from(inlineData.data, 'base64');

    return {
      buffer,
      provider: 'google-media',
      model,
      modality: 'tts',
      latencyMs: Date.now() - start,
      usage: {
        cost: 0,
        input: options.text.length,
        unit: 'per_1k_chars',
      },
      media: {
        format: 'wav', // Google returns PCM L16, essentially WAV
      },
    };
  }

  async video(options: VideoOptions): Promise<NoosphereResult> {
    const model = options.model ?? 'veo-2.0-generate-001';
    const start = Date.now();

    const body: Record<string, unknown> = {
      instances: [{ prompt: options.prompt }],
      parameters: {
        sampleCount: 1,
      },
    };
    if (options.duration) (body.parameters as any).durationSeconds = options.duration;

    // Veo uses predictLongRunning — returns an operation to poll
    const res = await fetch(
      `${GOOGLE_API_BASE}/models/${model}:predictLongRunning?key=${this.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
    );

    if (!res.ok) {
      const errorBody = await res.text();
      throw new Error(`Google video generation failed (${res.status}): ${errorBody}`);
    }

    const operation = await res.json() as any;
    const operationName = operation?.name;

    if (!operationName) {
      throw new Error('Google video generation returned no operation name');
    }

    // Poll the operation until done (max 5 minutes)
    const deadline = Date.now() + 300000;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 5000));

      const pollRes = await fetch(
        `${GOOGLE_API_BASE}/${operationName}?key=${this.apiKey}`,
      );
      if (!pollRes.ok) continue;

      const status = await pollRes.json() as any;
      if (status.done) {
        // Check for errors
        if (status.error) {
          throw new Error(`Google video generation error: ${status.error.message ?? JSON.stringify(status.error)}`);
        }

        // Response structure: response.generateVideoResponse.generatedSamples[0].video.uri
        const resp = status.response ?? {};
        const samples = resp.generateVideoResponse?.generatedSamples
          ?? resp.generatedSamples
          ?? [];
        const video = samples[0]?.video;

        if (video?.bytesBase64Encoded) {
          return {
            buffer: Buffer.from(video.bytesBase64Encoded, 'base64'),
            provider: 'google-media',
            model,
            modality: 'video',
            latencyMs: Date.now() - start,
            usage: { cost: 0, unit: 'per_video' },
            media: { format: 'mp4', duration: options.duration },
          };
        }

        if (video?.uri) {
          // Download the video from the URI (follows redirects)
          const separator = video.uri.includes('?') ? '&' : '?';
          const videoRes = await fetch(`${video.uri}${separator}key=${this.apiKey}`, { redirect: 'follow' });
          if (videoRes.ok) {
            const buffer = Buffer.from(await videoRes.arrayBuffer());
            return {
              buffer,
              provider: 'google-media',
              model,
              modality: 'video',
              latencyMs: Date.now() - start,
              usage: { cost: 0, unit: 'per_video' },
              media: { format: 'mp4', duration: options.duration },
            };
          }
          // If download fails, return the URI
          return {
            url: video.uri,
            provider: 'google-media',
            model,
            modality: 'video',
            latencyMs: Date.now() - start,
            usage: { cost: 0, unit: 'per_video' },
            media: { format: 'mp4', duration: options.duration },
          };
        }

        throw new Error('Google video generation completed but returned no video data');
      }
    }

    throw new Error(`Google video generation timed out after 5 minutes`);
  }
}
