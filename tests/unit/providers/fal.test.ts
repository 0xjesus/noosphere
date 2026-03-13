// tests/unit/providers/fal.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@fal-ai/client', () => ({
  fal: {
    config: vi.fn(),
    subscribe: vi.fn().mockResolvedValue({
      data: {
        images: [{ url: 'https://fal.ai/output/image.png', width: 1024, height: 1024 }],
      },
      requestId: 'req-123',
    }),
    run: vi.fn().mockResolvedValue({
      data: {
        audio_url: 'https://fal.ai/output/audio.mp3',
      },
      requestId: 'req-456',
    }),
  },
}));

// Mock fetch for pricing API
global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  json: () => Promise.resolve([
    { modelId: 'fal-ai/flux-2-pro', price: 0.05, unit: 'per_image' },
    { modelId: 'fal-ai/kokoro', price: 0.02, unit: 'per_1k_chars' },
  ]),
}) as any;

import { FalProvider } from '../../../src/providers/fal.js';

describe('FalProvider', () => {
  let provider: FalProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new FalProvider('fal-test-key');
  });

  it('has correct metadata', () => {
    expect(provider.id).toBe('fal');
    expect(provider.modalities).toEqual(['image', 'video', 'tts']);
    expect(provider.isLocal).toBe(false);
  });

  it('ping returns true when key is set', async () => {
    expect(await provider.ping()).toBe(true);
  });

  it('image calls fal.subscribe and normalizes result', async () => {
    const result = await provider.image!({
      prompt: 'a dragon',
      model: 'fal-ai/flux-2-pro',
    });

    expect(result.url).toBe('https://fal.ai/output/image.png');
    expect(result.provider).toBe('fal');
    expect(result.modality).toBe('image');
    expect(result.media?.width).toBe(1024);
    expect(result.media?.height).toBe(1024);
  });

  it('speak calls fal.run and normalizes result', async () => {
    const result = await provider.speak!({
      text: 'Hello world',
      model: 'fal-ai/kokoro',
    });

    expect(result.url).toBe('https://fal.ai/output/audio.mp3');
    expect(result.provider).toBe('fal');
    expect(result.modality).toBe('tts');
  });
});
