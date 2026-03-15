// tests/integration/media-providers.test.ts
// Integration tests for OpenAI and Google media providers.
// Requires real API keys: OPENAI_API_KEY, GEMINI_API_KEY
// Run with: npx vitest run tests/integration/media-providers.test.ts

import { describe, it, expect } from 'vitest';
import { OpenAIMediaProvider } from '../../src/providers/openai-media.js';
import { GoogleMediaProvider } from '../../src/providers/google-media.js';

const OPENAI_KEY = process.env.OPENAI_API_KEY;
const GOOGLE_KEY = process.env.GEMINI_API_KEY;

// --- OpenAI Media ---

describe.skipIf(!OPENAI_KEY)('OpenAI Media Provider', () => {
  const provider = new OpenAIMediaProvider(OPENAI_KEY!);

  it('ping returns true', async () => {
    const result = await provider.ping();
    expect(result).toBe(true);
  });

  it('listModels returns image, video, tts, and stt models', async () => {
    const all = await provider.listModels();
    expect(all.length).toBeGreaterThan(0);

    const imageModels = all.filter((m) => m.modality === 'image');
    const videoModels = all.filter((m) => m.modality === 'video');
    const ttsModels = all.filter((m) => m.modality === 'tts');
    const sttModels = all.filter((m) => m.modality === 'stt');

    console.log(`OpenAI media models: ${imageModels.length} image, ${videoModels.length} video, ${ttsModels.length} tts, ${sttModels.length} stt`);
    console.log('Image:', imageModels.map((m) => m.id).join(', '));
    console.log('Video:', videoModels.map((m) => m.id).join(', '));
    console.log('TTS:', ttsModels.map((m) => m.id).join(', '));
    console.log('STT:', sttModels.map((m) => m.id).join(', '));

    expect(imageModels.length).toBeGreaterThan(0);
    expect(videoModels.length).toBeGreaterThan(0);
    expect(ttsModels.length).toBeGreaterThan(0);
    expect(sttModels.length).toBeGreaterThan(0);

    // Verify all have correct provider and logo
    for (const m of all) {
      expect(m.provider).toBe('openai-media');
      expect(m.logo).toBeDefined();
      expect(m.logo?.png).toContain('openai');
    }
  });

  it('listModels filters by modality', async () => {
    const imageOnly = await provider.listModels('image');
    const ttsOnly = await provider.listModels('tts');
    const sttOnly = await provider.listModels('stt');
    const llmOnly = await provider.listModels('llm');

    expect(imageOnly.every((m) => m.modality === 'image')).toBe(true);
    expect(ttsOnly.every((m) => m.modality === 'tts')).toBe(true);
    expect(sttOnly.every((m) => m.modality === 'stt')).toBe(true);
    expect(llmOnly).toHaveLength(0); // No LLM models in this provider
  });

  it('generates an image with gpt-image-1 (default)', async () => {
    const result = await provider.image({
      prompt: 'A small red cube on a white background, minimal',
      width: 1024,
      height: 1024,
    });

    console.log('gpt-image-1 result:', { bufferSize: result.buffer?.length, latencyMs: result.latencyMs });

    expect(result.buffer).toBeDefined();
    expect(result.buffer!.length).toBeGreaterThan(1000);
    expect(result.provider).toBe('openai-media');
    expect(result.model).toBe('gpt-image-1');
    expect(result.modality).toBe('image');
    expect(result.latencyMs).toBeGreaterThan(0);
  }, 120000);

  it('generates an image with DALL-E 3', async () => {
    const result = await provider.image({
      prompt: 'A small blue sphere on a white background, minimal',
      model: 'dall-e-3',
      width: 1024,
      height: 1024,
    });

    console.log('DALL-E 3 result:', { url: result.url?.slice(0, 80) + '...', latencyMs: result.latencyMs });

    expect(result.url).toBeDefined();
    expect(result.url).toContain('http');
    expect(result.provider).toBe('openai-media');
    expect(result.model).toBe('dall-e-3');
    expect(result.modality).toBe('image');
  }, 60000);

  it('generates TTS audio', async () => {
    const result = await provider.speak({
      text: 'Hello world',
      model: 'tts-1',
      voice: 'alloy',
      format: 'mp3',
    });

    console.log('TTS result:', { bufferSize: result.buffer?.length, latencyMs: result.latencyMs });

    expect(result.buffer).toBeDefined();
    expect(result.buffer!.length).toBeGreaterThan(1000); // MP3 should be at least 1KB
    expect(result.provider).toBe('openai-media');
    expect(result.model).toBe('tts-1');
    expect(result.modality).toBe('tts');
  }, 30000);
});

// --- Google Media ---

describe.skipIf(!GOOGLE_KEY)('Google Media Provider', () => {
  const provider = new GoogleMediaProvider(GOOGLE_KEY!);

  it('ping returns true', async () => {
    const result = await provider.ping();
    expect(result).toBe(true);
  });

  it('listModels returns image and video models', async () => {
    const all = await provider.listModels();
    const imageModels = all.filter((m) => m.modality === 'image');
    const videoModels = all.filter((m) => m.modality === 'video');

    console.log(`Google media models: ${imageModels.length} image, ${videoModels.length} video`);
    for (const m of all) {
      console.log(`  ${m.id} [${m.modality}] — ${m.description?.slice(0, 80) ?? '(no desc)'}`);
    }

    expect(all.length).toBeGreaterThan(0);
    expect(all.every((m) => m.provider === 'google-media')).toBe(true);

    // Should have Imagen models
    const imagen = imageModels.find((m) => m.id.includes('imagen'));
    expect(imagen).toBeDefined();

    // Should have Veo models
    const veo = videoModels.find((m) => m.id.includes('veo'));
    expect(veo).toBeDefined();
  });

  it('generates an image with Imagen', async () => {
    const result = await provider.image({
      prompt: 'A small blue sphere on a white background, minimal',
    });

    console.log('Imagen result:', { bufferSize: result.buffer?.length, latencyMs: result.latencyMs });

    expect(result.buffer).toBeDefined();
    expect(result.buffer!.length).toBeGreaterThan(1000);
    expect(result.provider).toBe('google-media');
    expect(result.modality).toBe('image');
    expect(result.latencyMs).toBeGreaterThan(0);
  }, 60000);
});

// --- Full Noosphere integration ---

describe.skipIf(!OPENAI_KEY)('Noosphere unified API with OpenAI media', () => {
  it('getModels returns image/tts/stt models from openai-media', async () => {
    // Lazy import to avoid initialization side effects
    const { Noosphere } = await import('../../src/noosphere.js');
    const ai = new Noosphere({ autoDetectLocal: false });

    await ai.syncModels('image');
    const imageModels = await ai.getModels('image');
    const openaiImages = imageModels.filter((m) => m.provider === 'openai-media');

    console.log('Noosphere image models from openai-media:', openaiImages.map((m) => m.id));
    expect(openaiImages.length).toBeGreaterThan(0);

    await ai.syncModels('tts');
    const ttsModels = await ai.getModels('tts');
    const openaiTts = ttsModels.filter((m) => m.provider === 'openai-media');

    console.log('Noosphere TTS models from openai-media:', openaiTts.map((m) => m.id));
    expect(openaiTts.length).toBeGreaterThan(0);
  }, 30000);
});
