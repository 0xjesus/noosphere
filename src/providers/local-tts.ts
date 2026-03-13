// src/providers/local-tts.ts
import type { NoosphereProvider } from './base.js';
import type { Modality, ModelInfo, SpeakOptions, NoosphereResult } from '../types.js';

interface LocalTTSConfig {
  id: string;
  name: string;
  host: string;
  port: number;
}

export class LocalTTSProvider implements NoosphereProvider {
  readonly id: string;
  readonly name: string;
  readonly modalities: Modality[] = ['tts'];
  readonly isLocal = true;

  private baseUrl: string;

  constructor(config: LocalTTSConfig) {
    this.id = config.id;
    this.name = config.name;
    this.baseUrl = `${config.host}:${config.port}`;
  }

  async ping(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/health`);
      return res.ok;
    } catch {
      return false;
    }
  }

  async listModels(modality?: Modality): Promise<ModelInfo[]> {
    if (modality && modality !== 'tts') return [];

    try {
      // Try Piper-style /voices endpoint first (returns array directly)
      let voices: Array<{ id: string; name?: string }> = [];

      try {
        const res = await fetch(`${this.baseUrl}/voices`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            voices = data as Array<{ id: string; name?: string }>;
          }
        }
      } catch {
        // Fall back to OpenAI-compatible /v1/models endpoint
        const res = await fetch(`${this.baseUrl}/v1/models`);
        if (res.ok) {
          const data = await res.json() as { data?: Array<{ id: string }> };
          voices = data.data ?? [];
        }
      }

      return voices.map((v) => ({
        id: v.id,
        provider: this.id,
        name: v.name ?? v.id,
        modality: 'tts' as const,
        local: true,
        cost: { price: 0, unit: 'free' },
        capabilities: { voices: voices.map((vv) => vv.id) },
      }));
    } catch {
      return [];
    }
  }

  async speak(options: SpeakOptions): Promise<NoosphereResult> {
    const start = Date.now();

    // OpenAI-compatible TTS endpoint
    const res = await fetch(`${this.baseUrl}/v1/audio/speech`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: options.model ?? 'tts-1',
        input: options.text,
        voice: options.voice ?? 'default',
        speed: options.speed ?? 1.0,
        response_format: options.format ?? 'mp3',
      }),
    });

    if (!res.ok) {
      throw new Error(`Local TTS failed: ${res.status} ${await res.text()}`);
    }

    const audioBuffer = Buffer.from(await res.arrayBuffer());

    return {
      buffer: audioBuffer,
      provider: this.id,
      model: options.model ?? options.voice ?? 'default',
      modality: 'tts',
      latencyMs: Date.now() - start,
      usage: {
        cost: 0,
        input: options.text.length,
        unit: 'characters',
      },
      media: {
        format: options.format ?? 'mp3',
      },
    };
  }
}
